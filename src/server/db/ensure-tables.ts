import { createUserDb } from "~/server/db";

// Track which DB URLs have already had their tables ensured this process lifetime.
// Avoids redundant CREATE TABLE / ALTER TABLE round-trips on every request.
const ensured = new Set<string>();

// ---------------------------------------------------------------------------
// Single source of truth for lazy per-user-DB migrations.
//
// Brand-new databases get every table from USER_DB_INIT_SQL in the signup
// route. This module heals *legacy* databases that were provisioned before a
// given table/column existed. Both must stay in sync with schema.ts.
// ---------------------------------------------------------------------------

// CREATE TABLE IF NOT EXISTS statements — safe to run on every cold start.
// DDL is copied verbatim from USER_DB_INIT_SQL (src/app/api/signup/route.ts).
const CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`introspect_wiki_pages\` (
    \`slug\` TEXT PRIMARY KEY NOT NULL,
    \`title\` TEXT NOT NULL,
    \`category\` TEXT NOT NULL,
    \`content\` TEXT NOT NULL,
    \`tags\` TEXT,
    \`updatedAt\` INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS \`introspect_wiki_edges\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`fromSlug\` TEXT NOT NULL,
    \`toSlug\` TEXT NOT NULL,
    \`relation\` TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`introspect_chat_messages\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`role\` TEXT NOT NULL,
    \`content\` TEXT NOT NULL,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS \`introspect_push_subscriptions\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`endpoint\` TEXT NOT NULL,
    \`p256dh\` TEXT NOT NULL,
    \`auth\` TEXT NOT NULL,
    \`userAgent\` TEXT,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS \`introspect_reminders\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`enabled\` INTEGER DEFAULT 0,
    \`intervalHours\` INTEGER DEFAULT 3,
    \`lastNotifiedAt\` INTEGER,
    \`updatedAt\` INTEGER
  )`,
];

// Columns added to existing tables after initial launch. Each is attempted
// individually; a "duplicate column name" error means it already exists and is
// swallowed.
const ALTER_TABLE_STATEMENTS = [
  "ALTER TABLE `introspect_settings` ADD COLUMN `mode` TEXT",
  "ALTER TABLE `introspect_settings` ADD COLUMN `tier` TEXT",
];

/**
 * Idempotently ensure a per-user database has every table and column the
 * current code expects. Uses raw SQL via the libsql client to avoid needing
 * drizzle-kit migrations on every user's individual DB.
 *
 * Runs at most once per DB per process. If the DB URL can't be resolved we run
 * the migrations anyway (rather than caching under a shared "unknown" key that
 * would skip every subsequent DB).
 */
export async function ensureUserTables(db: ReturnType<typeof createUserDb>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = (db as any).$client as {
    execute: (sql: string) => Promise<unknown>;
    config?: { url?: string };
    // local client exposes .filename, remote exposes .config.url
    filename?: string;
  };

  // Build a cache key from the db URL so we run at most once per DB per process.
  // A null key means "unresolvable" → don't cache, just run every time.
  const cacheKey: string | null =
    rawClient.config?.url ?? rawClient.filename ?? null;

  if (cacheKey !== null && ensured.has(cacheKey)) return;

  for (const stmt of CREATE_TABLE_STATEMENTS) {
    await rawClient.execute(stmt);
  }

  for (const stmt of ALTER_TABLE_STATEMENTS) {
    try {
      await rawClient.execute(stmt);
    } catch {
      // Column already exists — ignore.
    }
  }

  if (cacheKey !== null) ensured.add(cacheKey);
}
