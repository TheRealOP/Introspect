import { habitsRouter } from "~/server/api/routers/habits";
import { insightsRouter } from "~/server/api/routers/insights";
import { journalRouter } from "~/server/api/routers/journal";
import { postRouter } from "~/server/api/routers/post";
import { settingsRouter } from "~/server/api/routers/settings";
import { wikiRouter } from "~/server/api/routers/wiki";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  journal: journalRouter,
  habits: habitsRouter,
  insights: insightsRouter,
  settings: settingsRouter,
  wiki: wikiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
