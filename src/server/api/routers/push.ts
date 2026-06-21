import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { pushSubscriptions } from "~/server/db/schema";

export const pushRouter = createTRPCRouter({
  // Store a new push subscription for this device (upsert by endpoint)
  subscribe: publicProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
        userAgent: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(pushSubscriptions)
          .set({
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            userAgent: input.userAgent ?? null,
          })
          .where(eq(pushSubscriptions.id, existing.id));
      } else {
        await ctx.db.insert(pushSubscriptions).values({
          id: uuid(),
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
        });
      }

      return { ok: true };
    }),

  // Remove a push subscription when the user disables reminders on this device
  unsubscribe: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint));
      return { ok: true };
    }),

  // Check if the current device (by endpoint) is subscribed
  isSubscribed: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))
        .limit(1);
      return { subscribed: !!row };
    }),
});
