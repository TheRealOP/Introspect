import { z } from "zod";
import type { LanguageModel } from "ai";

import { generateStructured } from "~/server/ai/structured";
import type { StructuredMode } from "~/server/ai/structured";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const aiExtractionSchema = z.object({
  habits: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The name of the detected habit, capitalized. Limit to 3 words.",
          ),
        sentiment: z
          .enum(["positive", "negative", "neutral"])
          .describe(
            "Whether this habit helps, hurts, or is neutral to the user's wellbeing.",
          ),
      }),
    )
    .describe(
      "List of recurring habits or behavioral patterns detected in this journal entry.",
    ),

  plans: z
    .array(z.string())
    .length(3)
    .describe(
      "Exactly 3 distinct mini-plans for what the user should focus on until their next check-in. Each should be a concrete, 1-2 sentence intention grounded in what the user just reported.",
    ),
});

export type AiExtraction = z.infer<typeof aiExtractionSchema>;

// ---------------------------------------------------------------------------
// Extraction function
// ---------------------------------------------------------------------------

type PreviousEntry = { content: string; createdAt: number | null };

export async function extractFromEntry(
  model: LanguageModel,
  latest: string,
  previous: PreviousEntry[],
  selectedPlans: string[] = [],
  mode: StructuredMode = "auto",
): Promise<AiExtraction> {
  const previousBlock =
    previous.length > 0
      ? previous
          .map((e, i) => {
            const date = e.createdAt
              ? new Date(e.createdAt * 1000).toLocaleString()
              : `Entry ${i + 1}`;
            return `[${date}]\n${e.content}`;
          })
          .join("\n\n")
      : "No previous entries yet.";

  return generateStructured({
    model,
    mode,
    schema: aiExtractionSchema,
    toolName: "extract",
    toolDescription:
      "Extract habits and mini-plans from the user's check-in entries.",
    temperature: 0.2,
    system: `You are a behavioral coach helping users set clear intentions for their next working session.
Analyze the user's check-in to spot habits and patterns.
Then generate exactly 3 mini-plans: short, concrete statements of intent for what the user should do until their next check-in.
Rules for every mini-plan:
- 1-2 sentences max, 30 words or fewer
- Start with an action verb
- Be specific to what's actually in their check-in — don't be generic
- Describe a realistic focus for the next 1-3 hours
- Address different angles across the 3 plans (e.g. the main task, a side obligation, a recovery/rest need)
Do NOT suggest: calling someone, journaling (they're already here), vague self-care platitudes, or anything requiring hours of setup.
Write each plan as a direct, confident statement. No preamble, no explanation.`,
    prompt: `--- Previous check-ins (oldest first) ---
${previousBlock}

${selectedPlans.length > 0 ? `--- Plans this user has previously committed to (reveals their priorities) ---\n${selectedPlans.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n` : ""}--- Latest check-in ---
${latest}`,
  });
}
