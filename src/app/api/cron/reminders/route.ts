import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { sendPush } from "~/server/push";
import { createUserDb } from "~/server/db";
import { listUsers } from "~/server/db/users-client";
import { entries, pushSubscriptions, reminders } from "~/server/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Lazily ensure the push/reminders tables exist in a user DB.
// Mirrors initUsersDb() in users-client.ts — uses raw SQL via the underlying
// libsql client so we don't need drizzle migrations on every user's DB.
async function ensureReminderTables(db: ReturnType<typeof createUserDb>) {
  // Access the underlying libsql client through drizzle's internal reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = (db as any).$client as {
    execute: (sql: string) => Promise<unknown>;
  };

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
}

export async function GET(request: Request) {
  // Guard: require ?secret= matching CRON_SECRET
  const url = new URL(request.url);
  const secret =
    url.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const users = await listUsers();

  let checked = 0;
  let notified = 0;

  for (const user of users) {
    try {
      const db = createUserDb(user.dbUrl, user.dbAuthToken);
      await ensureReminderTables(db);

      // Read reminder settings
      const [reminderRow] = await db
        .select()
        .from(reminders)
        .where(eq(reminders.id, "default"))
        .limit(1);

      checked++;

      if (!reminderRow || !reminderRow.enabled) continue;

      const intervalSeconds = (reminderRow.intervalHours ?? 3) * 3600;

      // Skip if we already notified within this interval
      if (
        reminderRow.lastNotifiedAt &&
        now - reminderRow.lastNotifiedAt < intervalSeconds
      ) {
        continue;
      }

      // Get the latest check-in time
      const [latestEntry] = await db
        .select({ createdAt: entries.createdAt })
        .from(entries)
        .orderBy(desc(entries.createdAt))
        .limit(1);

      const lastEntryAt = latestEntry?.createdAt ?? 0;

      // Only notify if the user hasn't checked in within their chosen interval
      if (lastEntryAt && now - lastEntryAt < intervalSeconds) continue;

      // Fetch all subscriptions for this user
      const subs = await db.select().from(pushSubscriptions);
      if (subs.length === 0) continue;

      const payload = {
        title: "Time to check in ✍️",
        body:
          lastEntryAt === 0
            ? "Start tracking your day — what have you been up to?"
            : "What have you done since your last check-in?",
        url: "/",
      };

      let sentAny = false;

      for (const sub of subs) {
        const result = await sendPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );

        if (result.ok) {
          sentAny = true;
        } else if (result.gone) {
          // Subscription expired — clean it up
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
      }

      if (sentAny) {
        await db
          .update(reminders)
          .set({ lastNotifiedAt: now })
          .where(eq(reminders.id, "default"));
        notified++;
      }
    } catch (err) {
      console.error(`[cron/reminders] error for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ checked, notified });
}
