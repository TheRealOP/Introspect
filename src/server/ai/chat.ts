import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { z } from "zod";

import { generateStructured } from "~/server/ai/structured";
import type { StructuredMode } from "~/server/ai/structured";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WikiPage = {
  slug: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
};

export type WikiEdge = {
  fromSlug: string;
  toSlug: string;
  relation: string;
};

export type HabitSummary = {
  name: string;
  sentiment: string;
  occurrences: number;
  currentStreak: number;
};

export type EntrySnippet = {
  content: string;
  createdAt: number | null;
};

// ---------------------------------------------------------------------------
// Build the system prompt context block from all available user data
// ---------------------------------------------------------------------------

export function buildChatContext(
  wikiPages: WikiPage[],
  wikiEdges: WikiEdge[],
  habits: HabitSummary[],
  recentEntries: EntrySnippet[],
): string {
  const wikiBlock =
    wikiPages.length > 0
      ? wikiPages
          .map((p) => `### [${p.category}] ${p.title}\n${p.content}`)
          .join("\n\n")
      : "No wiki pages yet — this is the first conversation.";

  const edgeBlock =
    wikiEdges.length > 0
      ? wikiEdges.map((e) => `- ${e.fromSlug} → ${e.relation} → ${e.toSlug}`).join("\n")
      : "No connections yet.";

  const habitsBlock =
    habits.length > 0
      ? habits
          .map(
            (h) =>
              `- ${h.name} (${h.sentiment}, seen ${h.occurrences}×, streak: ${h.currentStreak}d)`,
          )
          .join("\n")
      : "No habits tracked yet.";

  const entriesBlock =
    recentEntries.length > 0
      ? recentEntries
          .map((e) => {
            const date = e.createdAt
              ? new Date(e.createdAt * 1000).toLocaleDateString()
              : "unknown";
            return `[${date}] ${e.content}`;
          })
          .join("\n\n")
      : "No journal entries yet.";

  return `## User Wiki Profile
${wikiBlock}

## Graph Connections
${edgeBlock}

## Tracked Habits
${habitsBlock}

## Recent Journal Entries (last 5)
${entriesBlock}`;
}

// ---------------------------------------------------------------------------
// Wiki update schema — structured ops the AI emits after each turn
// ---------------------------------------------------------------------------

const wikiOpsSchema = z.object({
  upsertPages: z
    .array(
      z.object({
        slug: z.string().describe("kebab-case unique identifier, e.g. 'morning-routine'"),
        title: z.string(),
        category: z
          .enum(["identity", "habits", "blockers", "goals", "thinking", "context"])
          .describe("The category this page belongs to."),
        content: z
          .string()
          .describe("Markdown prose. 2–6 sentences. Factual, not speculative."),
        tags: z.array(z.string()).describe("2–5 short lowercase tags."),
      }),
    )
    .describe(
      "Pages to create or update. Only include if the conversation revealed something new or corrected something wrong. Empty array if nothing changed.",
    ),
  upsertEdges: z
    .array(
      z.object({
        fromSlug: z.string(),
        toSlug: z.string(),
        relation: z
          .string()
          .describe(
            "e.g. 'blocks', 'supports', 'is-part-of', 'conflicts-with', 'leads-to'",
          ),
      }),
    )
    .describe("New graph edges to add. Only edges supported by what was said."),
});

export type WikiOps = z.infer<typeof wikiOpsSchema>;

// ---------------------------------------------------------------------------
// Extract wiki updates from a completed conversation turn
// ---------------------------------------------------------------------------

export async function extractWikiUpdates(
  model: LanguageModel,
  userMessage: string,
  assistantResponse: string,
  existingPages: WikiPage[],
  mode: StructuredMode = "auto",
): Promise<WikiOps> {
  const existingSlugList =
    existingPages.length > 0
      ? existingPages.map((p) => `- ${p.slug}: ${p.title}`).join("\n")
      : "None yet.";

  try {
    return await generateStructured({
      model,
      mode,
      schema: wikiOpsSchema,
      toolName: "updateWiki",
      toolDescription: "Update the user's wiki profile based on what was just discussed.",
      temperature: 0.1,
      system: `You are maintaining a wiki-style knowledge graph profile for a user.
After each chat turn, extract any new facts, beliefs, patterns, or goals the user revealed and encode them as wiki page upserts or graph edges.

Rules:
- Only write what the user actually said — no inference beyond what's stated
- Update an existing page (same slug) if the user corrected or added to it
- Create a new page only if it's genuinely a new concept not covered by existing pages
- Keep content factual and concise (2–6 sentences of markdown)
- If nothing new was revealed, return empty arrays
- Slugs must be kebab-case, lowercase, descriptive

Existing wiki pages:
${existingSlugList}`,
      prompt: `--- User said ---
${userMessage}

--- Assistant responded ---
${assistantResponse}`,
    });
  } catch {
    // Wiki update is best-effort — don't crash the chat stream
    return { upsertPages: [], upsertEdges: [] };
  }
}
