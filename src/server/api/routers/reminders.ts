import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reminders } from "~/server/db/schema";

export const remindersRouter = createTRPCRouter({
  get: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(reminders)
      .where(eq(reminders.id, "default"))
      .limit(1);

    return {
      enabled: (row?.enabled ?? 0) === 1,
      intervalHours: row?.intervalHours ?? 3,
    };
  }),

  update: publicProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        intervalHours: z.number().int().min(1).max(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = Math.floor(Date.now() / 1000);

      const [existing] = await ctx.db
        .select({ id: reminders.id })
        .from(reminders)
        .where(eq(reminders.id, "default"))
        .limit(1);

      const row = {
        id: "default" as const,
        enabled: input.enabled ? 1 : 0,
        intervalHours: input.intervalHours,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db
          .update(reminders)
          .set(row)
          .where(eq(reminders.id, "default"));
      } else {
        await ctx.db.insert(reminders).values(row);
      }

      return { ok: true };
    }),
});
