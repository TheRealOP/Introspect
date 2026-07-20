import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

import { createUserDb } from "~/server/db";
import {
  createUser,
  createVerificationToken,
  getUserByEmail,
  initUsersDb,
} from "~/server/db/users-client";
import { sendVerificationEmail } from "~/server/email";
import { checkRateLimit } from "~/server/rate-limit";
import { provisionUserDb } from "~/server/turso";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SQL to initialise all tables in a brand-new user database
const USER_DB_INIT_SQL = `
  CREATE TABLE IF NOT EXISTS \`introspect_entries\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`content\` TEXT NOT NULL,
    \`plan\` TEXT,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_habits\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`name\` TEXT NOT NULL,
    \`sentiment\` TEXT NOT NULL,
    \`occurrences\` INTEGER DEFAULT 1,
    \`lastSeen\` INTEGER
  );
  CREATE TABLE IF NOT EXISTS \`introspect_nudges\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`entryId\` TEXT,
    \`action\` TEXT NOT NULL,
    \`selected\` INTEGER DEFAULT 0,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_habit_occurrences\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`habitId\` TEXT NOT NULL,
    \`entryId\` TEXT,
    \`seenAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_settings\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`provider\` TEXT,
    \`model\` TEXT,
    \`apiKey\` TEXT,
    \`baseUrl\` TEXT,
    \`mode\` TEXT,
    \`tier\` TEXT,
    \`updatedAt\` INTEGER
  );
  CREATE TABLE IF NOT EXISTS \`introspect_profile\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`summary\` TEXT,
    \`habitTags\` TEXT,
    \`suggestions\` TEXT,
    \`nudgePreference\` TEXT,
    \`entryCount\` INTEGER DEFAULT 0,
    \`updatedAt\` INTEGER
  );
  CREATE TABLE IF NOT EXISTS \`introspect_wiki_pages\` (
    \`slug\` TEXT PRIMARY KEY NOT NULL,
    \`title\` TEXT NOT NULL,
    \`category\` TEXT NOT NULL,
    \`content\` TEXT NOT NULL,
    \`tags\` TEXT,
    \`updatedAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_wiki_edges\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`fromSlug\` TEXT NOT NULL,
    \`toSlug\` TEXT NOT NULL,
    \`relation\` TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`introspect_chat_messages\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`role\` TEXT NOT NULL,
    \`content\` TEXT NOT NULL,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_push_subscriptions\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`endpoint\` TEXT NOT NULL,
    \`p256dh\` TEXT NOT NULL,
    \`auth\` TEXT NOT NULL,
    \`userAgent\` TEXT,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_reminders\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`enabled\` INTEGER DEFAULT 0,
    \`intervalHours\` INTEGER DEFAULT 3,
    \`lastNotifiedAt\` INTEGER,
    \`updatedAt\` INTEGER
  );
  CREATE TABLE IF NOT EXISTS \`introspect_routines\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`name\` TEXT NOT NULL,
    \`daysOfWeek\` TEXT,
    \`anchorMinutes\` INTEGER,
    \`archived\` INTEGER DEFAULT 0,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_routine_steps\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`routineId\` TEXT NOT NULL,
    \`position\` INTEGER NOT NULL,
    \`name\` TEXT NOT NULL,
    \`habitId\` TEXT,
    \`minSeconds\` INTEGER,
    \`maxSeconds\` INTEGER
  );
  CREATE TABLE IF NOT EXISTS \`introspect_routine_runs\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`routineId\` TEXT NOT NULL,
    \`startedAt\` INTEGER NOT NULL,
    \`endedAt\` INTEGER,
    \`status\` TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`introspect_step_runs\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`runId\` TEXT NOT NULL,
    \`stepId\` TEXT NOT NULL,
    \`name\` TEXT NOT NULL,
    \`startedAt\` INTEGER NOT NULL,
    \`endedAt\` INTEGER,
    \`status\` TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`introspect_timeline_events\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`title\` TEXT NOT NULL,
    \`kind\` TEXT NOT NULL,
    \`startAt\` INTEGER NOT NULL,
    \`endAt\` INTEGER NOT NULL,
    \`sourceId\` TEXT,
    \`createdAt\` INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS \`introspect_todos\` (
    \`id\` TEXT PRIMARY KEY NOT NULL,
    \`title\` TEXT NOT NULL,
    \`status\` TEXT NOT NULL DEFAULT 'open',
    \`source\` TEXT NOT NULL DEFAULT 'extracted',
    \`entryId\` TEXT,
    \`completedByEntryId\` TEXT,
    \`createdAt\` INTEGER DEFAULT (unixepoch()),
    \`completedAt\` INTEGER
  );
`;

export async function POST(req: Request) {
  try {
    // Rate limit before any DB provisioning or email send — cheap check
    // that protects Turso/Resend quotas from unauthenticated abuse.
    const rateLimit = await checkRateLimit(req, "signup", {
      perIp: [
        { windowSeconds: 60 * 60, max: 5 }, // 5/hour
        { windowSeconds: 60 * 60 * 24, max: 20 }, // 20/day
      ],
      global: { windowSeconds: 60 * 60 * 24, max: 100 }, // 100/day across all IPs
    });
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many attempts, please try again later" },
        { status: 429 },
      );
    }

    const body = (await req.json()) as { email?: string; password?: string };
    const { password } = body;
    const email = body.email?.trim().toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    await initUsersDb();

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const id = uuid();
    const passwordHash = await bcrypt.hash(password, 12);

    // Provision a dedicated Turso database for this user
    const { dbUrl, dbAuthToken } = await provisionUserDb(id);

    // Initialise all tables in the new database
    const userDb = createUserDb(dbUrl, dbAuthToken);
    for (const statement of USER_DB_INIT_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await userDb.run(sql.raw(statement));
    }

    // Save the user record in the central users database (unverified)
    await createUser({ id, email, passwordHash, dbUrl, dbAuthToken });

    // Send verification email
    const token = await createVerificationToken(email);
    const origin = new URL(req.url).origin;
    const verifyUrl = `${origin}/api/verify?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    return NextResponse.json({ ok: true, needsVerification: true });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
