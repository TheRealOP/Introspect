import { desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { streamText } from "ai";

import { auth } from "~/server/auth";
import { createUserDb } from "~/server/db";
import {
  chatMessages,
  entries,
  habits,
  habitOccurrences,
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.dbUrl) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createUserDb(session.user.dbUrl, session.user.dbAuthToken);

  const body = (await req.json()) as { messages: { role: string; content: string }[] };
  const messages = body.messages ?? [];

  // The last message is always from the user
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  // Load context in parallel
  const [allWikiPages, allWikiEdges, allHabits, recentEntries] = await Promise.all([
    db.select().from(wikiPages),
    db.select().from(wikiEdges),
    db.select().from(habits),
    db
      .select({ content: entries.content, createdAt: entries.createdAt })
      .from(entries)
      .orderBy(desc(entries.createdAt))
      .limit(5),
  ]);

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
    tags: p.tags ? (JSON.parse(p.tags) as string[]) : [],
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

      // Update wiki in background — don't block the stream
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
        .catch(console.error);
    },
  });

  return result.toTextStreamResponse();
}
