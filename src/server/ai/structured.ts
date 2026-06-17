import { generateObject, generateText, tool } from "ai";
import type { LanguageModel } from "ai";
import type { ZodTypeAny } from "zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StructuredMode = "auto" | "tool" | "json";

type Options<T extends ZodTypeAny> = {
  model: LanguageModel;
  schema: T;
  toolName: string;
  toolDescription: string;
  system: string;
  prompt: string;
  temperature?: number;
  mode?: StructuredMode;
};

// ---------------------------------------------------------------------------
// Internal runners
// ---------------------------------------------------------------------------

async function runTool<T extends ZodTypeAny>(opts: Options<T>): Promise<z.infer<T>> {
  const { model, schema, toolName, toolDescription, system, prompt, temperature } = opts;
  const { toolCalls } = await generateText({
    model,
    temperature: temperature ?? 0.2,
    tools: {
      [toolName]: tool({ description: toolDescription, inputSchema: schema }),
    },
    toolChoice: { type: "tool", toolName },
    system,
    prompt,
  });
  const call = toolCalls.find((c) => c.toolName === toolName);
  if (!call) throw new Error(`AI did not call the '${toolName}' tool`);
  return call.input as z.infer<T>;
}

async function runJson<T extends ZodTypeAny>(opts: Options<T>): Promise<z.infer<T>> {
  const { model, schema, system, prompt, temperature } = opts;
  const { object } = await generateObject({
    model,
    schema,
    temperature: temperature ?? 0.2,
    system,
    prompt,
  });
  return object;
}

async function runTextFallback<T extends ZodTypeAny>(opts: Options<T>): Promise<z.infer<T>> {
  const { model, schema, system, prompt, temperature } = opts;
  const { text } = await generateText({
    model,
    temperature: temperature ?? 0.2,
    system:
      system +
      "\n\nIMPORTANT: Respond with ONLY a valid JSON object — no markdown fences, no explanation.",
    prompt,
  });
  // Extract the first {...} block
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (!jsonMatch) throw new Error("AI response contained no JSON object");
  const parsed = schema.safeParse(JSON.parse(jsonMatch[0])) as ReturnType<
    typeof schema.safeParse
  >;
  if (!parsed.success) {
    throw new Error(`JSON output didn't match schema: ${(parsed as z.SafeParseError<unknown>).error.message}`);
  }
  return (parsed as z.SafeParseSuccess<z.infer<T>>).data;
}

function looksLikeToolUnsupported(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("tool") ||
      msg.includes("function call") ||
      msg.includes("unsupported") ||
      msg.includes("not support")
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate structured output from a model, with mode control:
 *
 * - "tool"  → forced tool call (current behaviour, requires tool-capable model)
 * - "json"  → generateObject JSON mode
 * - "auto"  → try tool first; if the model rejects it, fall back to JSON, then
 *             plain-text + regex parse (works with Gemma, small local models, etc.)
 */
export async function generateStructured<T extends ZodTypeAny>(
  opts: Options<T>,
): Promise<z.infer<T>> {
  const mode = opts.mode ?? "auto";

  if (mode === "tool") return runTool(opts);
  if (mode === "json") return runJson(opts);

  // auto: tool → json → text
  try {
    return await runTool(opts);
  } catch (toolErr) {
    if (!looksLikeToolUnsupported(toolErr)) throw toolErr;
    // fall through to json
  }
  try {
    return await runJson(opts);
  } catch {
    return runTextFallback(opts);
  }
}

// ---------------------------------------------------------------------------
// Utility: known model patterns that struggle with tool calling
// ---------------------------------------------------------------------------

const WEAK_TOOL_RE = /^gemma|^phi-2/i;

export function isWeakToolModel(modelId: string): boolean {
  return WEAK_TOOL_RE.test(modelId);
}
