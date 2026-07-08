import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { chatMessages, wikiEdges, wikiPages } from "~/server/db/schema";

// Tolerate malformed JSON in the tags column so one bad row can't 500 the query.
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export const wikiRouter = createTRPCRouter({
  // All wiki pages — for the graph view
  pages: publicProcedure.query(async ({ ctx }) => {
    const pages = await ctx.db.select().from(wikiPages);
    return pages.map((p) => ({
      ...p,
      tags: parseTags(p.tags),
    }));
  }),

  // All edges — for the graph view
  edges: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(wikiEdges);
  }),

  // Single page by slug
  page: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(wikiPages)
        .where(eq(wikiPages.slug, input.slug))
        .limit(1);
      if (!row) return null;
      return { ...row, tags: parseTags(row.tags) };
    }),

  // Recent chat history for initializing useChat
  chatHistory: publicProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(chatMessages)
        .orderBy(desc(chatMessages.createdAt))
        .limit(input.limit);
      // Return oldest-first for chat display
      return rows.reverse().map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
      }));
    }),
});
