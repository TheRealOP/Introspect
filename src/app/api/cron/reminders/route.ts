import { and, desc, eq, gte, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { sendPush } from "~/server/push";
import { createUserDb } from "~/server/db";
import { ensureUserTables } from "~/server/db/ensure-tables";
import { listUsers } from "~/server/db/users-client";
import {
  entries,
  pushSubscriptions,
  reminders,
  routineRuns,
  routines,
} from "~/server/db/schema";

function parseDays(json: string | null): number[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((d): d is number => typeof d === "number") : [];
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  // Guard: require `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
  // header automatically. We deliberately do NOT accept a ?secret= query param —
  // URLs leak into access logs and proxies (audit M4).
  const secret = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");

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
      await ensureUserTables(db);

      // Read reminder settings
      const [reminderRow] = await db
        .select()
        .from(reminders)
        .where(eq(reminders.id, "default"))
        .limit(1);

      checked++;

      if (!reminderRow || !reminderRow.enabled) continue;

      // Fetch all subscriptions for this user (shared by both notification kinds)
      const subs = await db.select().from(pushSubscriptions);
      if (subs.length === 0) continue;

      const sendToAll = async (payload: { title: string; body: string; url: string }) => {
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
        return sentAny;
      };

      // ---------------------------------------------------------------------
      // 1) Check-in reminder (existing behaviour)
      // ---------------------------------------------------------------------
      const intervalSeconds = (reminderRow.intervalHours ?? 3) * 3600;

      const alreadyNotified =
        reminderRow.lastNotifiedAt && now - reminderRow.lastNotifiedAt < intervalSeconds;

      if (!alreadyNotified) {
        // Get the latest check-in time
        const [latestEntry] = await db
          .select({ createdAt: entries.createdAt })
          .from(entries)
          .orderBy(desc(entries.createdAt))
          .limit(1);

        const lastEntryAt = latestEntry?.createdAt ?? 0;

        // Only notify if the user hasn't checked in within their chosen interval
        if (!lastEntryAt || now - lastEntryAt >= intervalSeconds) {
          const sentAny = await sendToAll({
            title: "Time to check in ✍️",
            body:
              lastEntryAt === 0
                ? "Start tracking your day — what have you been up to?"
                : "What have you done since your last check-in?",
            url: "/",
          });

          if (sentAny) {
            await db
              .update(reminders)
              .set({ lastNotifiedAt: now })
              .where(eq(reminders.id, "default"));
            notified++;
          }
        }
      }

      // ---------------------------------------------------------------------
      // 2) Missed-routine nudge: routines scheduled yesterday with no run.
      // The cron fires once a day (Vercel Hobby), so this can't fire twice for
      // the same day. Day boundaries are UTC — a known v1 approximation.
      // ---------------------------------------------------------------------
      const todayStart = now - (now % 86400);
      const yesterdayStart = todayStart - 86400;
      const yesterdayDow = new Date(yesterdayStart * 1000).getUTCDay();

      const allRoutines = await db.select().from(routines);
      const scheduledYesterday = allRoutines.filter(
        (r) => !r.archived && parseDays(r.daysOfWeek).includes(yesterdayDow),
      );

      if (scheduledYesterday.length > 0) {
        const yesterdayRuns = await db
          .select()
          .from(routineRuns)
          .where(
            and(
              gte(routineRuns.startedAt, yesterdayStart),
              lt(routineRuns.startedAt, todayStart),
            ),
          );

        const missed = scheduledYesterday.filter(
          (r) => !yesterdayRuns.some((run) => run.routineId === r.id),
        );

        if (missed.length > 0) {
          const names = missed.map((r) => r.name).join(", ");
          const sentAny = await sendToAll({
            title: "Routine missed yesterday",
            body: `${names} didn't happen yesterday — restart the chain today.`,
            url: "/routines",
          });
          if (sentAny) notified++;
        }
      }
    } catch (err) {
      console.error(`[cron/reminders] error for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ checked, notified });
}
