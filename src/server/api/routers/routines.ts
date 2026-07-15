import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

import { resolveAi } from "~/server/ai/provider";
import { suggestRoutineSteps } from "~/server/ai/routine-suggest";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { UserDb } from "~/server/db";
import {
  habitOccurrences,
  habits,
  profile,
  routineRuns,
  routineSteps,
  routines,
  stepRuns,
  timelineEvents,
  wikiPages,
} from "~/server/db/schema";

const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrderedSteps(db: UserDb, routineId: string) {
  return db
    .select()
    .from(routineSteps)
    .where(eq(routineSteps.routineId, routineId))
    .orderBy(asc(routineSteps.position));
}

// Close the run's currently-active step. For completed steps this also writes
// the timeline event and, when the step is linked to a habit, logs a sighting
// (max one per habit per ~day) so routine completions feed streaks.
// "deferred" closes the attempt but leaves the step in the remaining pool.
async function closeActiveStep(
  db: UserDb,
  runId: string,
  status: "completed" | "skipped" | "incomplete" | "deferred",
) {
  const [current] = await db
    .select()
    .from(stepRuns)
    .where(and(eq(stepRuns.runId, runId), eq(stepRuns.status, "active")))
    .limit(1);

  if (!current) return null;

  const endedAt = now();
  await db
    .update(stepRuns)
    .set({ status, endedAt })
    .where(eq(stepRuns.id, current.id));

  if (status === "completed") {
    await db.insert(timelineEvents).values({
      id: uuid(),
      title: current.name,
      kind: "routine_step",
      startAt: current.startedAt,
      endAt: endedAt,
      sourceId: current.id,
    });

    const [step] = await db
      .select()
      .from(routineSteps)
      .where(eq(routineSteps.id, current.stepId))
      .limit(1);

    if (step?.habitId) {
      const [habit] = await db
        .select()
        .from(habits)
        .where(eq(habits.id, step.habitId))
        .limit(1);

      if (habit) {
        // Dedupe: at most one routine-driven sighting per habit per ~day
        const [recent] = await db
          .select({ id: habitOccurrences.id })
          .from(habitOccurrences)
          .where(
            and(
              eq(habitOccurrences.habitId, habit.id),
              gte(habitOccurrences.seenAt, endedAt - 20 * 3600),
            ),
          )
          .limit(1);

        if (!recent) {
          await db.insert(habitOccurrences).values({
            id: uuid(),
            habitId: habit.id,
            entryId: null,
            seenAt: endedAt,
          });
          await db
            .update(habits)
            .set({
              occurrences: (habit.occurrences ?? 1) + 1,
              lastSeen: endedAt,
            })
            .where(eq(habits.id, habit.id));
        }
      }
    }
  }

  return current;
}

// A step is still "remaining" in a run if none of its attempts reached a
// terminal state — deferred attempts (and steps never started) stay available.
function remainingRunSteps(
  steps: (typeof routineSteps.$inferSelect)[],
  runStepRows: (typeof stepRuns.$inferSelect)[],
) {
  const settled = new Set(
    runStepRows.filter((r) => r.status !== "deferred").map((r) => r.stepId),
  );
  return steps.filter((s) => !settled.has(s.id));
}

// After a step closes, either finish the run (nothing left to do) or leave it
// in the "choosing" state — active run with no active step — so the user picks
// what comes next.
async function maybeFinishRun(db: UserDb, runId: string) {
  const [run] = await db
    .select()
    .from(routineRuns)
    .where(eq(routineRuns.id, runId))
    .limit(1);
  if (!run) return { done: true };

  const steps = await getOrderedSteps(db, run.routineId);
  const runStepRows = await db
    .select()
    .from(stepRuns)
    .where(eq(stepRuns.runId, runId));

  if (remainingRunSteps(steps, runStepRows).length === 0) {
    await db
      .update(routineRuns)
      .set({ status: "completed", endedAt: now() })
      .where(eq(routineRuns.id, runId));
    return { done: true };
  }

  return { done: false, choosing: true };
}

// Full state of the single active run (if any) — the run screen is rendered
// entirely from this, which is what makes it refresh-proof.
async function activeRunState(db: UserDb) {
  const [run] = await db
    .select()
    .from(routineRuns)
    .where(eq(routineRuns.status, "active"))
    .limit(1);
  if (!run) return null;

  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, run.routineId))
    .limit(1);

  const steps = await getOrderedSteps(db, run.routineId);
  const runSteps = await db
    .select()
    .from(stepRuns)
    .where(eq(stepRuns.runId, run.id))
    .orderBy(asc(stepRuns.startedAt));

  const currentStepRun = runSteps.find((s) => s.status === "active") ?? null;
  const currentStep = currentStepRun
    ? (steps.find((s) => s.id === currentStepRun.stepId) ?? null)
    : null;

  return {
    run,
    routineName: routine?.name ?? "Routine",
    steps,
    runSteps,
    currentStepRun,
    currentStep,
    // No active step + remaining steps = the "what's next?" chooser state
    remainingSteps: remainingRunSteps(steps, runSteps),
    serverNow: now(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const routinesRouter = createTRPCRouter({
  // Routines with ordered steps + a summary of the most recent run
  list: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db
      .select()
      .from(routines)
      .where(eq(routines.archived, 0))
      .orderBy(asc(routines.createdAt));

    if (all.length === 0) return [];

    const steps = await ctx.db
      .select()
      .from(routineSteps)
      .where(
        inArray(
          routineSteps.routineId,
          all.map((r) => r.id),
        ),
      )
      .orderBy(asc(routineSteps.position));

    const runs = await ctx.db
      .select()
      .from(routineRuns)
      .orderBy(desc(routineRuns.startedAt));

    return all.map((r) => ({
      ...r,
      steps: steps.filter((s) => s.routineId === r.id),
      lastRun: runs.find((run) => run.routineId === r.id) ?? null,
    }));
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        anchorMinutes: z.number().min(0).max(1439).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      await ctx.db.insert(routines).values({
        id,
        name: input.name,
        daysOfWeek: input.daysOfWeek ? JSON.stringify(input.daysOfWeek) : null,
        anchorMinutes: input.anchorMinutes ?? null,
      });
      return { id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        daysOfWeek: z.array(z.number().min(0).max(6)).nullish(),
        anchorMinutes: z.number().min(0).max(1439).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(routines)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.daysOfWeek !== undefined
            ? { daysOfWeek: input.daysOfWeek ? JSON.stringify(input.daysOfWeek) : null }
            : {}),
          ...(input.anchorMinutes !== undefined
            ? { anchorMinutes: input.anchorMinutes }
            : {}),
        })
        .where(eq(routines.id, input.id));
      return { ok: true };
    }),

  // Steps are removed with the routine; historical runs/step_runs are kept
  // (step_runs carry name snapshots so history still renders)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(routineSteps).where(eq(routineSteps.routineId, input.id));
      await ctx.db.delete(routines).where(eq(routines.id, input.id));
      return { ok: true };
    }),

  addStep: publicProcedure
    .input(
      z.object({
        routineId: z.string(),
        name: z.string().min(1),
        habitId: z.string().nullish(),
        minSeconds: z.number().positive().nullish(),
        maxSeconds: z.number().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getOrderedSteps(ctx.db, input.routineId);
      const id = uuid();
      await ctx.db.insert(routineSteps).values({
        id,
        routineId: input.routineId,
        position: existing.length,
        name: input.name,
        habitId: input.habitId ?? null,
        minSeconds: input.minSeconds ?? null,
        maxSeconds: input.maxSeconds ?? null,
      });
      return { id };
    }),

  updateStep: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        habitId: z.string().nullish(),
        minSeconds: z.number().positive().nullish(),
        maxSeconds: z.number().positive().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(routineSteps)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.habitId !== undefined ? { habitId: input.habitId } : {}),
          ...(input.minSeconds !== undefined ? { minSeconds: input.minSeconds } : {}),
          ...(input.maxSeconds !== undefined ? { maxSeconds: input.maxSeconds } : {}),
        })
        .where(eq(routineSteps.id, input.id));
      return { ok: true };
    }),

  removeStep: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [step] = await ctx.db
        .select()
        .from(routineSteps)
        .where(eq(routineSteps.id, input.id))
        .limit(1);
      if (!step) return { ok: true };

      await ctx.db.delete(routineSteps).where(eq(routineSteps.id, input.id));

      // Re-pack positions so ordering stays dense
      const rest = await getOrderedSteps(ctx.db, step.routineId);
      for (const [i, s] of rest.entries()) {
        if (s.position !== i) {
          await ctx.db
            .update(routineSteps)
            .set({ position: i })
            .where(eq(routineSteps.id, s.id));
        }
      }
      return { ok: true };
    }),

  reorderSteps: publicProcedure
    .input(z.object({ routineId: z.string(), orderedStepIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const [i, id] of input.orderedStepIds.entries()) {
        await ctx.db
          .update(routineSteps)
          .set({ position: i })
          .where(
            and(eq(routineSteps.id, id), eq(routineSteps.routineId, input.routineId)),
          );
      }
      return { ok: true };
    }),

  // -------------------------------------------------------------------------
  // Run lifecycle — server timestamps are the source of truth; the client
  // stopwatch only renders (serverNow - startedAt)
  // -------------------------------------------------------------------------

  startRun: publicProcedure
    .input(z.object({ routineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // One active run at a time — return the existing one instead of erroring
      const existing = await activeRunState(ctx.db);
      if (existing) return { runId: existing.run.id, alreadyActive: true };

      const steps = await getOrderedSteps(ctx.db, input.routineId);
      const first = steps[0];
      if (!first) throw new Error("Routine has no steps yet — add at least one");

      const runId = uuid();
      const startedAt = now();
      await ctx.db.insert(routineRuns).values({
        id: runId,
        routineId: input.routineId,
        startedAt,
        status: "active",
      });
      await ctx.db.insert(stepRuns).values({
        id: uuid(),
        runId,
        stepId: first.id,
        name: first.name,
        startedAt,
        status: "active",
      });
      return { runId, alreadyActive: false };
    }),

  activeRun: publicProcedure.query(({ ctx }) => activeRunState(ctx.db)),

  completeStep: publicProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const closed = await closeActiveStep(ctx.db, input.runId, "completed");
      if (!closed) return { done: true };
      return maybeFinishRun(ctx.db, input.runId);
    }),

  skipStep: publicProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const closed = await closeActiveStep(ctx.db, input.runId, "skipped");
      if (!closed) return { done: true };
      return maybeFinishRun(ctx.db, input.runId);
    }),

  // Put the current step back in the pool and drop into the chooser. The
  // deferred attempt keeps its timestamps but stays selectable.
  deferStep: publicProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await closeActiveStep(ctx.db, input.runId, "deferred");
      return { done: false, choosing: true };
    }),

  // Start a specific remaining step from the chooser
  chooseStep: publicProcedure
    .input(z.object({ runId: z.string(), stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const state = await activeRunState(ctx.db);
      if (!state || state.run.id !== input.runId) {
        throw new Error("Run is no longer active");
      }
      if (state.currentStepRun) {
        throw new Error("A step is already in progress");
      }
      const step = state.remainingSteps.find((s) => s.id === input.stepId);
      if (!step) throw new Error("That step isn't available to start");

      await ctx.db.insert(stepRuns).values({
        id: uuid(),
        runId: input.runId,
        stepId: step.id,
        name: step.name,
        startedAt: now(),
        status: "active",
      });
      return { ok: true };
    }),

  // Start an ad-hoc step that isn't part of the routine. The synthetic stepId
  // matches no routine_steps row, so it renders from its name snapshot and
  // skips habit logging — same as a step deleted after the fact.
  chooseCustomStep: publicProcedure
    .input(z.object({ runId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const state = await activeRunState(ctx.db);
      if (!state || state.run.id !== input.runId) {
        throw new Error("Run is no longer active");
      }
      if (state.currentStepRun) {
        throw new Error("A step is already in progress");
      }

      await ctx.db.insert(stepRuns).values({
        id: uuid(),
        runId: input.runId,
        stepId: uuid(),
        name: input.name.trim(),
        startedAt: now(),
        status: "active",
      });
      return { ok: true };
    }),

  // End the run early from the chooser; remaining steps are simply left unrun
  finishRun: publicProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await closeActiveStep(ctx.db, input.runId, "completed");
      await ctx.db
        .update(routineRuns)
        .set({ status: "completed", endedAt: now() })
        .where(eq(routineRuns.id, input.runId));
      return { done: true };
    }),

  abandonRun: publicProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await closeActiveStep(ctx.db, input.runId, "incomplete");
      await ctx.db
        .update(routineRuns)
        .set({ status: "abandoned", endedAt: now() })
        .where(eq(routineRuns.id, input.runId));
      return { ok: true };
    }),

  // AI: suggest the next habits to chain, grounded in the user's tracked
  // habits, profile summary, and wiki knowledge graph
  suggestSteps: publicProcedure
    .input(z.object({ routineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [routine] = await ctx.db
        .select()
        .from(routines)
        .where(eq(routines.id, input.routineId))
        .limit(1);
      if (!routine) throw new Error("Routine not found");

      const steps = await getOrderedSteps(ctx.db, input.routineId);
      const allHabits = await ctx.db.select().from(habits);
      const [prof] = await ctx.db
        .select()
        .from(profile)
        .where(eq(profile.id, "default"))
        .limit(1);
      const pages = await ctx.db.select().from(wikiPages);

      const { model, mode } = await resolveAi(ctx.db);

      const result = await suggestRoutineSteps(
        model,
        {
          routineName: routine.name,
          steps: steps.map((s) => ({
            name: s.name,
            minSeconds: s.minSeconds,
            maxSeconds: s.maxSeconds,
          })),
          habits: allHabits.map((h) => ({
            id: h.id,
            name: h.name,
            sentiment: h.sentiment,
            occurrences: h.occurrences,
          })),
          profileSummary: prof?.summary ?? null,
          wikiHighlights: pages
            .filter((p) => ["habits", "goals", "blockers"].includes(p.category))
            .slice(0, 12)
            .map((p) => ({ title: p.title, category: p.category, content: p.content })),
        },
        mode,
      );

      // Drop hallucinated habit links
      const validIds = new Set(allHabits.map((h) => h.id));
      return result.suggestions.map((s) => ({
        ...s,
        habitId: s.habitId && validIds.has(s.habitId) ? s.habitId : null,
      }));
    }),

  runHistory: publicProcedure
    .input(z.object({ routineId: z.string().optional(), limit: z.number().max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const runs = await ctx.db
        .select()
        .from(routineRuns)
        .where(input.routineId ? eq(routineRuns.routineId, input.routineId) : undefined)
        .orderBy(desc(routineRuns.startedAt))
        .limit(input.limit);

      if (runs.length === 0) return [];

      const allStepRuns = await ctx.db
        .select()
        .from(stepRuns)
        .where(
          inArray(
            stepRuns.runId,
            runs.map((r) => r.id),
          ),
        )
        .orderBy(asc(stepRuns.startedAt));

      return runs.map((run) => ({
        ...run,
        steps: allStepRuns.filter((s) => s.runId === run.id),
      }));
    }),
});
