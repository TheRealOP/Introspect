import type { LanguageModel } from "ai";
import { z } from "zod";

import { generateStructured } from "~/server/ai/structured";
import type { StructuredMode } from "~/server/ai/structured";

// ---------------------------------------------------------------------------
// Suggest habits to chain onto a routine (Atomic Habits stacking), grounded in
// what the AI already knows about the user — extracted habits, profile, wiki.
// ---------------------------------------------------------------------------

const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Short imperative step name, e.g. 'Drink a glass of water'. Max 6 words."),
        reason: z
          .string()
          .describe("One sentence: why this step, for THIS user, chained at this point."),
        habitId: z
          .string()
          .nullish()
          .describe("id of the matching tracked habit from the list, if one clearly matches"),
        minSeconds: z
          .number()
          .nullish()
          .describe("Suggested minimum seconds, only if rushing would defeat the step"),
        maxSeconds: z
          .number()
          .nullish()
          .describe("Suggested maximum seconds, only if the step tends to overrun"),
      }),
    )
    .describe("Exactly 3 suggested next steps, best first."),
});

export type StepSuggestions = z.infer<typeof suggestionsSchema>;

export async function suggestRoutineSteps(
  model: LanguageModel,
  input: {
    routineName: string;
    steps: { name: string; minSeconds: number | null; maxSeconds: number | null }[];
    habits: { id: string; name: string; sentiment: string; occurrences: number | null }[];
    profileSummary: string | null;
    wikiHighlights: { title: string; category: string; content: string }[];
  },
  mode: StructuredMode = "auto",
): Promise<StepSuggestions> {
  const chainBlock =
    input.steps.length > 0
      ? input.steps.map((s, i) => `${i + 1}. ${s.name}`).join("\n")
      : "(empty — suggest good opening steps)";

  const habitsBlock =
    input.habits.length > 0
      ? input.habits
          .map((h) => `- [${h.id}] ${h.name} (${h.sentiment}, seen ${h.occurrences ?? 1}×)`)
          .join("\n")
      : "None tracked yet.";

  const wikiBlock =
    input.wikiHighlights.length > 0
      ? input.wikiHighlights
          .map((p) => `### [${p.category}] ${p.title}\n${p.content}`)
          .join("\n\n")
      : "No profile pages yet.";

  return generateStructured({
    model,
    mode,
    schema: suggestionsSchema,
    toolName: "suggestSteps",
    toolDescription: "Suggest the next habits to chain onto this routine.",
    temperature: 0.4,
    system: `You are a habit-stacking coach (Atomic Habits method). The user chains small habits into routines; each existing habit in the chain is an anchor for the next one.

Rules:
- Suggest steps that naturally follow the LAST step in the chain (physical location, momentum, context)
- Ground suggestions in what you know about this user — their tracked habits, goals, and blockers below
- Prefer converting a positive tracked habit they already do (set habitId) or countering a negative one
- Steps must be small and concrete — a single action, not a project
- Only set minSeconds/maxSeconds when the timing genuinely matters
- Never suggest a step already in the chain`,
    prompt: `Routine: "${input.routineName}"

Current chain:
${chainBlock}

User's tracked habits:
${habitsBlock}

User profile summary:
${input.profileSummary ?? "None yet."}

User knowledge pages:
${wikiBlock}

Suggest 3 next steps to chain.`,
  });
}
