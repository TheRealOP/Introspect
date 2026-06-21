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
import { provisionUserDb } from "~/server/turso";

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
`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
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
