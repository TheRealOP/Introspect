import { desc, eq, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { streamText } from "ai";
import { waitUntil } from "@vercel/functions";

import { createUserDb } from "~/server/db";
import { ensureUserTables } from "~/server/db/ensure-tables";
import { getUserDbCredentials } from "~/server/user-db";
import {
  chatMessages,
  entries,
  habits,
  habitOccurrences,
  routineRuns,
  routines,
  timelineEvents,
  wikiEdges,
  wikiPages,
} from "~/server/db/schema";
import { resolveAi } from "~/server/ai/provider";
import {
  buildChatContext,
  extractWikiUpdates,
  type WikiPage,
} from "~/server/ai/chat";

export const runtime = "nodejs";

// Tolerate malformed JSON in the tags column so one bad row can't 500 the route.
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const creds = await getUserDbCredentials(req.headers);
  if (!creds) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createUserDb(creds.dbUrl, creds.dbAuthToken);
  // Heal legacy DBs missing the chat/wiki tables before we query them.
  await ensureUserTables(db);

  const body = (await req.json()) as { messages: { role: string; content: string }[] };
  const messages = body.messages ?? [];

  // The last message is always from the user
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  const nowSec = Math.floor(Date.now() / 1000);

  // Load context in parallel
  const [allWikiPages, allWikiEdges, allHabits, recentEntries, allRoutines, recentRuns, recentEvents] =
    await Promise.all([
      db.select().from(wikiPages),
      db.select().from(wikiEdges),
      db.select().from(habits),
      db
        .select({ content: entries.content, createdAt: entries.createdAt })
        .from(entries)
        .orderBy(desc(entries.createdAt))
        .limit(5),
      db.select().from(routines),
      db
        .select()
        .from(routineRuns)
        .where(gte(routineRuns.startedAt, nowSec - 7 * 86400)),
      db
        .select()
        .from(timelineEvents)
        .where(gte(timelineEvents.endAt, nowSec - 86400))
        .orderBy(desc(timelineEvents.startAt))
        .limit(30),
    ]);

  // Routine adherence over the last 7 days
  const routineAdherence = allRoutines
    .map((r) => {
      const runs = recentRuns.filter((run) => run.routineId === r.id);
      return {
        name: r.name,
        completed: runs.filter((run) => run.status === "completed").length,
        abandoned: runs.filter((run) => run.status === "abandoned").length,
        totalRuns: runs.length,
      };
    })
    .filter((r) => r.totalRuns > 0 || allRoutines.length <= 5);

  // Unaccounted time in the last 24h = window minus merged event coverage
  const windowStart = nowSec - 86400;
  let covered = 0;
  let cursor = windowStart;
  for (const e of [...recentEvents].sort((a, b) => a.startAt - b.startAt)) {
    const s = Math.max(e.startAt, cursor);
    const end = Math.min(e.endAt, nowSec);
    if (end > s) covered += end - s;
    cursor = Math.max(cursor, end);
  }
  const unaccountedSeconds = Math.max(0, 86400 - covered);

  // Build habit summaries (include occurrence counts from habitOccurrences for streak approximation)
  const allOccurrences = await db.select().from(habitOccurrences);
  const habitSummaries = allHabits.map((h) => {
    const sightings = allOccurrences.filter((o) => o.habitId === h.id);
    return {
      name: h.name,
      sentiment: h.sentiment,
      occurrences: h.occurrences ?? 1,
      currentStreak: sightings.length,
    };
  });

  const parsedPages: WikiPage[] = allWikiPages.map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    content: p.content,
    tags: parseTags(p.tags),
  }));

  const context = buildChatContext(
    parsedPages,
    allWikiEdges.map((e) => ({
      fromSlug: e.fromSlug,
      toSlug: e.toSlug,
      relation: e.relation,
    })),
    habitSummaries,
    recentEntries,
    routineAdherence,
    [...recentEvents]
      .sort((a, b) => a.startAt - b.startAt)
      .map((e) => ({ title: e.title, kind: e.kind, startAt: e.startAt, endAt: e.endAt })),
    unaccountedSeconds,
  );

  const { model, mode } = await resolveAi(db);

  const result = streamText({
    model,
    system: `You are a personal reflection coach with deep knowledge of this user.
Use their profile below to give grounded, specific responses — not generic advice.

When the user wants to understand themselves better, reflect patterns back clearly and ask one sharp follow-up question.
When the user wants you to learn about them, ask focused questions about one topic at a time — don't overwhelm.
Always be direct, warm, and concise. No filler. No lists unless the user asks.

${context}`,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    onFinish: async ({ text }) => {
      if (!lastUserMessage) return;

      // Persist the exchange
      const now = Math.floor(Date.now() / 1000);
      await db.insert(chatMessages).values([
        { id: uuid(), role: "user", content: lastUserMessage.content, createdAt: now },
        { id: uuid(), role: "assistant", content: text, createdAt: now + 1 },
      ]);

      // Update wiki in the background without blocking the stream. waitUntil
      // keeps the serverless function alive until the write finishes — a bare
      // floating promise would be killed when the function freezes (audit M2).
      waitUntil(
        extractWikiUpdates(model, lastUserMessage.content, text, parsedPages, mode)
        .then(async (ops) => {
          for (const page of ops.upsertPages) {
            const existing = await db
              .select({ slug: wikiPages.slug })
              .from(wikiPages)
              .where(eq(wikiPages.slug, page.slug))
              .limit(1);

            const row = {
              slug: page.slug,
              title: page.title,
              category: page.category,
              content: page.content,
              tags: JSON.stringify(page.tags),
              updatedAt: Math.floor(Date.now() / 1000),
            };

            if (existing.length > 0) {
              await db
                .update(wikiPages)
                .set(row)
                .where(eq(wikiPages.slug, page.slug));
            } else {
              await db.insert(wikiPages).values(row);
            }
          }

          for (const edge of ops.upsertEdges) {
            await db
              .insert(wikiEdges)
              .values({ id: uuid(), ...edge })
              .onConflictDoNothing();
          }
        })
        .catch(console.error),
      );
    },
  });

  return result.toTextStreamResponse();
}
