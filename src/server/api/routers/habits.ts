import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { habitOccurrences, habits } from "~/server/db/schema";

export const habitsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db
      .select()
      .from(habits)
      .orderBy(desc(habits.occurrences), desc(habits.lastSeen));
  }),

  updateSentiment: publicProcedure
    .input(z.object({ id: z.string(), sentiment: z.enum(["positive", "negative", "neutral"]) }))
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(habits)
        .set({ sentiment: input.sentiment })
        .where(eq(habits.id, input.id));
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(habitOccurrences).where(eq(habitOccurrences.habitId, input.id));
      await ctx.db.delete(habits).where(eq(habits.id, input.id));
      return { ok: true };
    }),
});
