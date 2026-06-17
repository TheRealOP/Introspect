import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { createUserDb } from "~/server/db";
import { ensureUserTables } from "~/server/db/ensure-tables";

// Columns added after initial launch — safe to run on every cold start
const SETTINGS_MIGRATIONS = [
  "ALTER TABLE `introspect_settings` ADD COLUMN `mode` TEXT",
  "ALTER TABLE `introspect_settings` ADD COLUMN `tier` TEXT",
];

async function migrateUserDb(db: ReturnType<typeof createUserDb>) {
  for (const stmt of SETTINGS_MIGRATIONS) {
    try {
      await db.run(sql.raw(stmt));
    } catch {
      // Column already exists — ignore
    }
  }
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  if (!session?.user?.dbUrl) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const db = createUserDb(session.user.dbUrl, session.user.dbAuthToken);
  await ensureUserTables(db);
  await migrateUserDb(db);

  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
