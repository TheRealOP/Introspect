import { and, asc, gte, lt } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { timelineEvents } from "~/server/db/schema";

export const timelineRouter = createTRPCRouter({
  // Events within [start, end) plus computed unaccounted gaps. The client
  // passes local-day bounds as unix seconds — the server never guesses the
  // user's timezone. Gaps are computed on the fly, never stored.
  day: publicProcedure
    .input(z.object({ start: z.number(), end: z.number() }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db
        .select()
        .from(timelineEvents)
        .where(
          and(
            gte(timelineEvents.endAt, input.start),
            lt(timelineEvents.startAt, input.end),
          ),
        )
        .orderBy(asc(timelineEvents.startAt));

      // Unaccounted time only exists in the past
      const now = Math.floor(Date.now() / 1000);
      const horizon = Math.min(input.end, now);

      const gaps: { startAt: number; endAt: number }[] = [];
      let cursor = input.start;
      for (const e of events) {
        const s = Math.max(e.startAt, input.start);
        if (s > cursor && cursor < horizon) {
          gaps.push({ startAt: cursor, endAt: Math.min(s, horizon) });
        }
        cursor = Math.max(cursor, Math.min(e.endAt, input.end));
      }
      if (cursor < horizon) gaps.push({ startAt: cursor, endAt: horizon });

      const accountedSeconds = Math.max(
        0,
        horizon - input.start - gaps.reduce((sum, g) => sum + (g.endAt - g.startAt), 0),
      );

      return {
        events,
        gaps,
        accountedSeconds,
        unaccountedSeconds: gaps.reduce((sum, g) => sum + (g.endAt - g.startAt), 0),
      };
    }),
});
