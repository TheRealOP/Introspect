import { createUserDb } from "~/server/db";

// Track which DB URLs have already had their tables ensured this process lifetime.
// Avoids redundant CREATE TABLE IF NOT EXISTS round-trips on every request.
const ensured = new Set<string>();

/**
 * Idempotently ensure the push/reminders tables exist in a per-user database.
 * Uses raw SQL via the libsql client to avoid needing drizzle-kit migrations on
 * every user's individual DB — mirrors the initUsersDb() pattern in users-client.ts.
 */
export async function ensureUserTables(db: ReturnType<typeof createUserDb>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = (db as any).$client as {
    execute: (sql: string) => Promise<unknown>;
    config?: { url?: string };
    // local client exposes .filename, remote exposes .config.url
    filename?: string;
  };

  // Build a cache key from the db URL so we run at most once per DB per process
  const url: string =
    rawClient.config?.url ?? rawClient.filename ?? "unknown";

  if (ensured.has(url)) return;

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS introspect_push_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      userAgent TEXT,
      createdAt INTEGER DEFAULT (unixepoch())
    )
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS introspect_reminders (
      id TEXT PRIMARY KEY NOT NULL,
      enabled INTEGER DEFAULT 0,
      intervalHours INTEGER DEFAULT 3,
      lastNotifiedAt INTEGER,
      updatedAt INTEGER
    )
  `);

  ensured.add(url);
}
