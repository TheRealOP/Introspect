import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { buildModelFromConfig, testConnection } from "~/server/ai/provider";
import type { AiConfig } from "~/server/ai/provider";
import { settings } from "~/server/db/schema";

export const settingsRouter = createTRPCRouter({
  get: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(settings)
      .where(eq(settings.id, "default"))
      .limit(1);

    if (!row) return null;

    return {
      provider: row.provider,
      model: row.model,
      hasApiKey: !!row.apiKey,
      baseUrl: row.baseUrl,
      mode: row.mode,
      tier: row.tier,
      updatedAt: row.updatedAt,
    };
  }),

  update: publicProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        mode: z.enum(["auto", "tool", "json"]).optional(),
        tier: z.enum(["hosted", "byo", "selfhost"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = Math.floor(Date.now() / 1000);

      const [existing] = await ctx.db
        .select({
          id: settings.id,
          provider: settings.provider,
          apiKey: settings.apiKey,
        })
        .from(settings)
        .where(eq(settings.id, "default"))
        .limit(1);

      // Blank key + same provider means "keep my saved key" — don't wipe it.
      const apiKey =
        input.apiKey ??
        (existing?.provider === input.provider ? existing.apiKey : null);

      // BYO providers only run on the user's own key — refuse to save without one.
      if (input.tier === "byo" && !apiKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An API key is required for this provider — bring your own.",
        });
      }

      const row = {
        id: "default" as const,
        provider: input.provider,
        model: input.model,
        apiKey,
        baseUrl: input.baseUrl ?? null,
        mode: input.mode ?? "auto",
        tier: input.tier ?? null,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.update(settings).set(row).where(eq(settings.id, "default"));
      } else {
        await ctx.db.insert(settings).values(row);
      }

      return { ok: true };
    }),

  clear: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(settings).where(eq(settings.id, "default"));
    return { ok: true };
  }),

  testConnection: publicProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        mode: z.enum(["auto", "tool", "json"]).optional(),
        tier: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.tier === "byo" && !input.apiKey) {
        return {
          ok: false as const,
          error: "An API key is required for this provider — bring your own.",
        };
      }

      const config: AiConfig = {
        provider: input.provider,
        model: input.model,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        mode: (input.mode as AiConfig["mode"]) ?? "auto",
        tier: input.tier ?? "byo",
      };

      // Validate we can build the model before attempting network call
      try {
        buildModelFromConfig(config);
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      return testConnection(config);
    }),
});
