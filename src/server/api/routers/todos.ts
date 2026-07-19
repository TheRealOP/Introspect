import { desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { todos } from "~/server/db/schema";

export const todosRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "done", "dismissed"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const query = ctx.db.select().from(todos).orderBy(desc(todos.createdAt));

      if (input?.status) {
        return query.where(eq(todos.status, input.status));
      }

      return query;
    }),

  add: publicProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const title = input.title.trim();

      const [inserted] = await ctx.db
        .insert(todos)
        .values({
          id,
          title,
          status: "open",
          source: "manual",
        })
        .returning({ id: todos.id, title: todos.title });

      return inserted;
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status: z.enum(["open", "done", "dismissed"]) }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {
        status: input.status,
      };

      if (input.status === "done") {
        updateData.completedAt = Math.floor(Date.now() / 1000);
      } else {
        updateData.completedAt = null;
        updateData.completedByEntryId = null;
      }

      await ctx.db.update(todos).set(updateData).where(eq(todos.id, input.id));

      return { ok: true };
    }),
});
