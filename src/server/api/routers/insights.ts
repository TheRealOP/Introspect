import { desc, eq, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

import { buildInsights } from "~/server/ai/insights";
import { resolveAi } from "~/server/ai/provider";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { entries, habitOccurrences, habits, nudges, profile } from "~/server/db/schema";

// Tolerate malformed JSON in the profile's serialized columns so one bad row
// can't 500 the whole query.
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Streak computation helper — pure JS over unix-second timestamps
// ---------------------------------------------------------------------------
function computeStreaks(seenAts: (number | null)[]): {
  current: number;
  longest: number;
} {
  const valid = seenAts.filter((t): t is number => t !== null);
  if (valid.length === 0) return { current: 0, longest: 0 };

  // Dedupe by calendar day (UTC) then sort ascending
  const days = [
    ...new Set(valid.map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))),
  ].sort();

  let longest = 1;
  let run = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]!).getTime();
    const curr = new Date(days[i]!).getTime();
    if ((curr - prev) / 86_400_000 === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Is the streak still active? (last sighting today or yesterday)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lastDay = days[days.length - 1];
  const current = lastDay === today || lastDay === yesterday ? run : 0;

  return { current, longest };
}

export const insightsRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Streaks — group habit_occurrences by habit, compute current + longest
  // -------------------------------------------------------------------------
  streaks: publicProcedure.query(async ({ ctx }) => {
    const allHabits = await ctx.db.select().from(habits);
    const allOccurrences = await ctx.db.select().from(habitOccurrences);

    return allHabits.map((h) => {
      const sightings = allOccurrences
        .filter((o) => o.habitId === h.id)
        .map((o) => o.seenAt);
      const { current, longest } = computeStreaks(sightings);
      return {
        id: h.id,
        name: h.name,
        sentiment: h.sentiment,
        occurrences: h.occurrences ?? 1,
        current,
        longest,
      };
    });
  }),

  // -------------------------------------------------------------------------
  // Nudge stats — selection counts from nudges.selected = 1
  // -------------------------------------------------------------------------
  nudgeStats: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .then((r) => Number(r[0]?.count ?? 0));

    const picked = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(eq(nudges.selected, 1))
      .then((r) => Number(r[0]?.count ?? 0));

    const topPicked = await ctx.db
      .select({
        action: nudges.action,
        count: sql<number>`count(*)`,
      })
      .from(nudges)
      .where(eq(nudges.selected, 1))
      .groupBy(nudges.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return {
      total,
      picked,
      pickRate: total > 0 ? Math.round((picked / total) * 100) : 0,
      topPicked: topPicked.map((r) => ({
        action: r.action,
        count: Number(r.count),
      })),
    };
  }),

  // -------------------------------------------------------------------------
  // Get cached profile + staleness flag
  // -------------------------------------------------------------------------
  get: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(profile)
      .where(eq(profile.id, "default"))
      .limit(1);

    const currentEntryCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .then((r) => Number(r[0]?.count ?? 0));

    if (!row) return { profile: null, isStale: currentEntryCount > 0 };

    const parsed = {
      summary: row.summary,
      habitTags: safeParse<{ name: string; tags: string[] }[]>(row.habitTags, []),
      suggestions: safeParse<string[]>(row.suggestions, []),
      nudgePreference: row.nudgePreference,
      updatedAt: row.updatedAt,
    };

    return {
      profile: parsed,
      isStale: currentEntryCount !== (row.entryCount ?? 0),
    };
  }),

  // -------------------------------------------------------------------------
  // Refresh — run AI, upsert singleton profile row
  // -------------------------------------------------------------------------
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const allHabits = await ctx.db.select().from(habits);
    const allOccurrences = await ctx.db.select().from(habitOccurrences);

    const habitsWithStreaks = allHabits.map((h) => {
      const sightings = allOccurrences
        .filter((o) => o.habitId === h.id)
        .map((o) => o.seenAt);
      const { current, longest } = computeStreaks(sightings);
      return {
        name: h.name,
        sentiment: h.sentiment,
        occurrences: h.occurrences,
        currentStreak: current,
        longestStreak: longest,
      };
    });

    const recentEntries = await ctx.db
      .select({ content: entries.content, createdAt: entries.createdAt })
      .from(entries)
      .orderBy(desc(entries.createdAt))
      .limit(10);

    const topPickedNudges = await ctx.db
      .select({
        action: nudges.action,
        count: sql<number>`count(*)`,
      })
      .from(nudges)
      .where(eq(nudges.selected, 1))
      .groupBy(nudges.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .then((rows) => rows.map((r) => ({ action: r.action, count: Number(r.count) })));

    const currentEntryCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .then((r) => Number(r[0]?.count ?? 0));

    const { model, mode } = await resolveAi(ctx.db);
    const result = await buildInsights(
      model,
      habitsWithStreaks,
      [...recentEntries].reverse(),
      topPickedNudges,
      mode,
    );

    const now = Math.floor(Date.now() / 1000);

    const [existing] = await ctx.db
      .select({ id: profile.id })
      .from(profile)
      .where(eq(profile.id, "default"))
      .limit(1);

    const row = {
      id: "default" as const,
      summary: result.summary,
      habitTags: JSON.stringify(result.habitTags),
      suggestions: JSON.stringify(result.suggestions),
      nudgePreference: result.nudgePreference,
      entryCount: currentEntryCount,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.update(profile).set(row).where(eq(profile.id, "default"));
    } else {
      await ctx.db.insert(profile).values(row);
    }

    return {
      profile: {
        summary: result.summary,
        habitTags: result.habitTags,
        suggestions: result.suggestions,
        nudgePreference: result.nudgePreference,
        updatedAt: now,
      },
      isStale: false,
    };
  }),
});

// Re-export streak type for frontend
export type HabitStreak = z.infer<typeof streakSchema>;
const streakSchema = z.object({
  id: z.string(),
  name: z.string(),
  sentiment: z.string(),
  occurrences: z.number(),
  current: z.number(),
  longest: z.number(),
});
