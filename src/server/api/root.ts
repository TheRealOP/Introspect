import { feedbackRouter } from "~/server/api/routers/feedback";
import { habitsRouter } from "~/server/api/routers/habits";
import { insightsRouter } from "~/server/api/routers/insights";
import { journalRouter } from "~/server/api/routers/journal";
import { pushRouter } from "~/server/api/routers/push";
import { remindersRouter } from "~/server/api/routers/reminders";
import { settingsRouter } from "~/server/api/routers/settings";
import { wikiRouter } from "~/server/api/routers/wiki";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  journal: journalRouter,
  habits: habitsRouter,
  insights: insightsRouter,
  settings: settingsRouter,
  wiki: wikiRouter,
  feedback: feedbackRouter,
  push: pushRouter,
  reminders: remindersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.journal.list();
 */
export const createCaller = createCallerFactory(appRouter);
