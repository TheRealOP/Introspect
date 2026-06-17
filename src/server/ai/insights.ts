import { z } from "zod";
import type { LanguageModel } from "ai";

import { generateStructured } from "~/server/ai/structured";
import type { StructuredMode } from "~/server/ai/structured";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

const HABIT_TAGS = ["aware", "unaware", "wantToBuild", "wantToRemove"] as const;

export const insightsSchema = z.object({
  summary: z
    .string()
    .describe(
      "3-sentence executive brief: top positive pattern, top negative pattern, overall trajectory.",
    ),
  habitTags: z
    .array(
      z.object({
        name: z.string().describe("Habit name, matching the provided habit list."),
        tags: z
          .array(z.enum(HABIT_TAGS))
          .min(1)
          .describe(
            "One or more tags. A habit can be both 'aware' and 'wantToRemove' simultaneously.",
          ),
      }),
    )
    .describe("Each known habit with its applicable tags."),
  suggestions: z
    .array(z.string())
    .describe(
      "2–4 small forward-looking habit ideas that complement what is already working. These are new habits, not from the current list.",
    ),
  nudgePreference: z
    .string()
    .describe(
      "One sentence describing the kinds of nudges this user tends to pick (e.g. physical, short, sensory-reset).",
    ),
});

export type InsightsResult = z.infer<typeof insightsSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type HabitRow = {
  name: string;
  sentiment: string;
  occurrences: number | null;
  currentStreak: number;
  longestStreak: number;
};

type NudgeStatRow = {
  action: string;
  count: number;
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildInsights(
  model: LanguageModel,
  habits: HabitRow[],
  recentEntries: { content: string; createdAt: number | null }[],
  topPickedNudges: NudgeStatRow[],
  mode: StructuredMode = "auto",
): Promise<InsightsResult> {
  const habitsBlock = habits
    .map(
      (h) =>
        `- ${h.name} (${h.sentiment}, ${h.occurrences ?? 1}× seen, current streak: ${h.currentStreak}d, longest: ${h.longestStreak}d)`,
    )
    .join("\n");

  const entriesBlock =
    recentEntries.length > 0
      ? recentEntries
          .map((e) => {
            const date = e.createdAt
              ? new Date(e.createdAt * 1000).toLocaleDateString()
              : "unknown date";
            return `[${date}] ${e.content}`;
          })
          .join("\n\n")
      : "No entries yet.";

  const nudgesBlock =
    topPickedNudges.length > 0
      ? topPickedNudges.map((n) => `- "${n.action}" (picked ${n.count}×)`).join("\n")
      : "No nudges selected yet.";

  return generateStructured({
    model,
    mode,
    schema: insightsSchema,
    toolName: "insights",
    toolDescription: "Produce an AI insights profile for the user based on their habit data.",
    temperature: 0.2,
    system: `You are a behavioral scientist building a knowledge-graph profile of a user from their habit-tracking data.

Tag rules (a habit can have multiple tags):
- "aware": the user explicitly names this habit in their check-ins
- "unaware": a recurring pattern visible across entries but never named by the user
- "wantToBuild": positive sentiment or expressed intent to do more of this
- "wantToRemove": negative sentiment or expressed desire to stop

Suggestions must be NEW habits not already in the list — small, complementary to what is working.
nudgePreference: describe what the nudges they pick have in common (length, type, tone). Be specific.`,
    prompt: `--- Known habits ---
${habitsBlock}

--- Recent check-ins (last 10) ---
${entriesBlock}

--- Nudges this user has picked (reveals preferences) ---
${nudgesBlock}`,
  });
}
