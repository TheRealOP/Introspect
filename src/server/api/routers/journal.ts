import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

import { extractFromEntry } from "~/server/ai/extract";
import type { AiExtraction } from "~/server/ai/extract";
import { resolveAi } from "~/server/ai/provider";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { UserDb } from "~/server/db";
import { entries, habitOccurrences, habits, nudges, timelineEvents, todos } from "~/server/db/schema";
import { computeStreaks } from "~/server/streaks";

// ---------------------------------------------------------------------------
// Shared habit upsert helper — also logs a sighting for streak tracking
// ---------------------------------------------------------------------------
async function upsertHabit(
  db: UserDb,
  habit: { name: string; sentiment: string },
  entryId: string | null,
  seenAt: number | null,
) {
  const normalised = habit.name.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(habits)
    .where(sql`lower(${habits.name}) = ${normalised}`)
    .limit(1);

  let habitId: string;

  if (existing) {
    await db
      .update(habits)
      .set({
        occurrences: (existing.occurrences ?? 1) + 1,
        sentiment: habit.sentiment,
        lastSeen: Math.floor(Date.now() / 1000),
      })
      .where(eq(habits.id, existing.id));
    habitId = existing.id;
  } else {
    habitId = uuid();
    await db.insert(habits).values({
      id: habitId,
      name: habit.name.trim(),
      sentiment: habit.sentiment,
      occurrences: 1,
      lastSeen: Math.floor(Date.now() / 1000),
    });
  }

  // Log the sighting for streak computation
  await db.insert(habitOccurrences).values({
    id: uuid(),
    habitId,
    entryId,
    seenAt: seenAt ?? Math.floor(Date.now() / 1000),
  });

  const sightings = await db
    .select({ seenAt: habitOccurrences.seenAt })
    .from(habitOccurrences)
    .where(eq(habitOccurrences.habitId, habitId));
  const { current } = computeStreaks(sightings.map((s) => s.seenAt));

  return { habitId, currentStreak: current };
}

// ---------------------------------------------------------------------------
// Shared todo-lifecycle helper — applies an extraction's completions + new
// todos against the open-todo list. Runs in both analyze and analyzeAll.
// ---------------------------------------------------------------------------
type OpenTodo = { id: string; title: string };

async function applyTodoExtraction(
  db: UserDb,
  extraction: AiExtraction,
  openTodos: OpenTodo[],
  entryId: string,
) {
  const completedTodos: OpenTodo[] = [];

  // Completions first — indexes are 1-based into openTodos. Small models
  // hallucinate, so bounds-check and silently skip anything invalid, and
  // dedupe repeated indexes.
  const seenIndexes = new Set<number>();
  for (const n of extraction.completedTodoIndexes) {
    if (!Number.isInteger(n) || n < 1 || n > openTodos.length) continue;
    if (seenIndexes.has(n)) continue;
    seenIndexes.add(n);

    const todo = openTodos[n - 1]!;
    await db
      .update(todos)
      .set({
        status: "done",
        completedAt: Math.floor(Date.now() / 1000),
        completedByEntryId: entryId,
      })
      .where(eq(todos.id, todo.id));
    completedTodos.push(todo);
  }

  // New todos — trim, drop empties, and dedupe (belt-and-braces on top of the
  // in-prompt dedup) against still-open todos and within the batch itself.
  const completedIds = new Set(completedTodos.map((t) => t.id));
  const stillOpenTitles = new Set(
    openTodos
      .filter((t) => !completedIds.has(t.id))
      .map((t) => t.title.trim().toLowerCase()),
  );
  const insertedTitles = new Set<string>();
  const newTodos: OpenTodo[] = [];
  for (const raw of extraction.newTodos) {
    const title = raw.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (stillOpenTitles.has(key) || insertedTitles.has(key)) continue;
    insertedTitles.add(key);

    const id = uuid();
    await db.insert(todos).values({
      id,
      title,
      status: "open",
      source: "extracted",
      entryId,
    });
    newTodos.push({ id, title });
  }

  return { newTodos, completedTodos };
}

export const journalRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Create a new check-in entry (returns immediately — no AI work here)
  // ---------------------------------------------------------------------------
  create: publicProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [previous] = await ctx.db
        .select({ createdAt: entries.createdAt })
        .from(entries)
        .orderBy(desc(entries.createdAt))
        .limit(1);

      const id = uuid();
      await ctx.db.insert(entries).values({ id, content: input.content });

      // Timeline block spanning from the previous check-in to now, capped at
      // 12h so the first entry after a long absence doesn't swallow the day
      const nowSec = Math.floor(Date.now() / 1000);
      const startAt = Math.max(previous?.createdAt ?? nowSec - 3600, nowSec - 12 * 3600);
      if (startAt < nowSec) {
        const title =
          input.content.length > 60 ? `${input.content.slice(0, 57)}…` : input.content;
        await ctx.db.insert(timelineEvents).values({
          id: uuid(),
          title,
          kind: "checkin",
          startAt,
          endAt: nowSec,
          sourceId: id,
        });
      }

      // Global check-in streak — consecutive calendar days with a check-in,
      // independent of AI analysis, so it's available the instant the entry saves
      const recentEntries = await ctx.db
        .select({ createdAt: entries.createdAt })
        .from(entries)
        .orderBy(desc(entries.createdAt))
        .limit(200);
      const checkinStreak = computeStreaks(recentEntries.map((e) => e.createdAt));

      return { id, checkinStreak };
    }),

  // ---------------------------------------------------------------------------
  // List all entries newest-first
  // ---------------------------------------------------------------------------
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(entries).orderBy(desc(entries.createdAt));
  }),

  // ---------------------------------------------------------------------------
  // Analyze an entry: run AI, upsert habits, insert 4 nudge options
  // ---------------------------------------------------------------------------
  analyze: publicProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(eq(entries.id, input.entryId))
        .limit(1);

      if (!entry) throw new Error(`Entry ${input.entryId} not found`);

      const previous = await ctx.db
        .select()
        .from(entries)
        .where(
          and(
            ne(entries.id, input.entryId),
            entry.createdAt !== null
              ? sql`${entries.createdAt} < ${entry.createdAt}`
              : undefined,
          ),
        )
        .orderBy(desc(entries.createdAt))
        .limit(5);

      const pastSelections = await ctx.db
        .select({ action: nudges.action })
        .from(nudges)
        .where(eq(nudges.selected, 1))
        .orderBy(desc(nudges.createdAt))
        .limit(10);

      const { model, mode } = await resolveAi(ctx.db);

      const openTodos = await ctx.db
        .select({ id: todos.id, title: todos.title })
        .from(todos)
        .where(eq(todos.status, "open"))
        .orderBy(asc(todos.createdAt));

      const extraction = await extractFromEntry(
        model,
        entry.content,
        [...previous].reverse(),
        pastSelections.map((s) => s.action),
        mode,
        openTodos,
      );

      const { newTodos, completedTodos } = await applyTodoExtraction(
        ctx.db,
        extraction,
        openTodos,
        input.entryId,
      );

      const habitsWithStreaks = [];
      for (const habit of extraction.habits) {
        const { currentStreak } = await upsertHabit(
          ctx.db,
          habit,
          input.entryId,
          entry.createdAt,
        );
        habitsWithStreaks.push({ ...habit, currentStreak });
      }

      const nudgeRows = extraction.plans.map((action) => ({
        id: uuid(),
        entryId: input.entryId,
        action,
        selected: 0,
      }));
      await ctx.db.insert(nudges).values(nudgeRows);

      return {
        habits: habitsWithStreaks,
        plans: nudgeRows.map((r) => ({ id: r.id, action: r.action, selected: false })),
        newTodos,
        completedTodos,
      };
    }),

  // ---------------------------------------------------------------------------
  // Backfill: analyze entries that don't yet have nudges.
  //
  // Capped at BATCH_SIZE entries per call so a large backlog can't blow the
  // serverless function timeout (audit M5). Returns how many are still pending
  // so the client can loop until `remaining` hits 0.
  // ---------------------------------------------------------------------------
  analyzeAll: publicProcedure.mutation(async ({ ctx }) => {
    const BATCH_SIZE = 10;

    const allEntries = await ctx.db
      .select()
      .from(entries)
      .orderBy(asc(entries.createdAt));

    const existingNudges = await ctx.db
      .select({ entryId: nudges.entryId })
      .from(nudges);
    const analyzedIds = new Set(existingNudges.map((n) => n.entryId));

    const pending = allEntries.filter((e) => !analyzedIds.has(e.id));
    const batch = pending.slice(0, BATCH_SIZE);

    const pastSelections = await ctx.db
      .select({ action: nudges.action })
      .from(nudges)
      .where(eq(nudges.selected, 1))
      .orderBy(desc(nudges.createdAt))
      .limit(10);

    const { model, mode } = await resolveAi(ctx.db);

    let analyzed = 0;

    for (const entry of batch) {
      const previous = allEntries
        .filter(
          (e) =>
            e.id !== entry.id &&
            (e.createdAt ?? 0) < (entry.createdAt ?? 0),
        )
        .slice(-5);

      // Re-fetch open todos fresh for each entry — this loop runs oldest-first,
      // so an earlier entry's inserts/completions must be visible to the next.
      const openTodos = await ctx.db
        .select({ id: todos.id, title: todos.title })
        .from(todos)
        .where(eq(todos.status, "open"))
        .orderBy(asc(todos.createdAt));

      const extraction = await extractFromEntry(
        model,
        entry.content,
        previous,
        pastSelections.map((s) => s.action),
        mode,
        openTodos,
      );

      await applyTodoExtraction(ctx.db, extraction, openTodos, entry.id);

      for (const habit of extraction.habits) {
        await upsertHabit(ctx.db, habit, entry.id, entry.createdAt);
      }

      await ctx.db.insert(nudges).values(
        extraction.plans.map((action) => ({
          id: uuid(),
          entryId: entry.id,
          action,
          selected: 0,
        })),
      );

      analyzed++;
    }

    return { analyzed, remaining: pending.length - analyzed };
  }),

  // ---------------------------------------------------------------------------
  // Select an AI-suggested plan + write it to entries.plan
  // ---------------------------------------------------------------------------
  selectPlan: publicProcedure
    .input(z.object({ nudgeId: z.string(), entryId: z.string(), action: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(nudges)
        .set({ selected: 0 })
        .where(eq(nudges.entryId, input.entryId));

      await ctx.db
        .update(nudges)
        .set({ selected: 1 })
        .where(eq(nudges.id, input.nudgeId));

      await ctx.db
        .update(entries)
        .set({ plan: input.action })
        .where(eq(entries.id, input.entryId));

      return { ok: true };
    }),

  // ---------------------------------------------------------------------------
  // Set a custom (user-written) plan on an entry
  // ---------------------------------------------------------------------------
  setPlan: publicProcedure
    .input(z.object({ entryId: z.string(), plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Clear any previously selected AI suggestion for this entry
      await ctx.db
        .update(nudges)
        .set({ selected: 0 })
        .where(eq(nudges.entryId, input.entryId));

      await ctx.db
        .update(entries)
        .set({ plan: input.plan })
        .where(eq(entries.id, input.entryId));

      return { ok: true };
    }),

  // ---------------------------------------------------------------------------
  // Fetch all nudge options for a specific entry
  // ---------------------------------------------------------------------------
  nudgesByEntry: publicProcedure
    .input(z.object({ entryId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db
        .select()
        .from(nudges)
        .where(eq(nudges.entryId, input.entryId))
        .orderBy(nudges.createdAt);
    }),
});
