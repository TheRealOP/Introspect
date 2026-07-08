import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import type { UserDb } from "~/server/db";
import { settings } from "~/server/db/schema";
import type { StructuredMode } from "~/server/ai/structured";

// ---------------------------------------------------------------------------
// Defaults — privacy-first: local Ollama if nothing is configured
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER = "ollama";
const DEFAULT_MODEL = "llama3.1:8b";
const DEFAULT_MODE: StructuredMode = "auto";
const OLLAMA_BASE_URL = "http://localhost:11434/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiConfig = {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  mode: StructuredMode;
  tier: string;
};

// ---------------------------------------------------------------------------
// Config resolution (DB row wins over env)
// ---------------------------------------------------------------------------

export async function getAiConfig(db: UserDb): Promise<AiConfig> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, "default"))
    .limit(1);

  if (row?.provider && row?.model) {
    return {
      provider: row.provider,
      model: row.model,
      apiKey: row.apiKey ?? undefined,
      baseUrl: row.baseUrl ?? undefined,
      mode: (row.mode as StructuredMode | null) ?? DEFAULT_MODE,
      tier: row.tier ?? inferTier(row.provider),
    };
  }

  // Env fallback. In production, silently defaulting to a local Ollama server
  // that doesn't exist produces a confusing connection error — fail loudly and
  // point the user at Settings instead. Ollama stays the default in dev.
  if (!env.AI_PROVIDER && env.NODE_ENV === "production") {
    throw new Error(
      "No AI provider configured — set one in Settings.",
    );
  }

  const provider = env.AI_PROVIDER ?? DEFAULT_PROVIDER;
  const model = env.AI_MODEL ?? DEFAULT_MODEL;

  const keyByProvider: Record<string, string | undefined> = {
    groq: env.GROQ_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    google: env.GOOGLE_GENERATIVE_AI_API_KEY,
    custom: env.OPENAI_API_KEY,
    ollama: undefined, // no key needed
    hosted: undefined,
  };

  return {
    provider,
    model,
    apiKey: keyByProvider[provider],
    baseUrl: env.AI_BASE_URL,
    mode: DEFAULT_MODE,
    tier: inferTier(provider),
  };
}

function inferTier(provider: string): string {
  if (provider === "hosted") return "hosted";
  if (provider === "ollama" || provider === "custom") return "selfhost";
  return "byo";
}

// ---------------------------------------------------------------------------
// Model builder (config → LanguageModel)
// ---------------------------------------------------------------------------

export function buildModelFromConfig(config: AiConfig): LanguageModel {
  const { provider, model, apiKey, baseUrl } = config;

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "ollama":
      // Ollama speaks the OpenAI API — no real key required
      return createOpenAI({
        apiKey: "ollama",
        baseURL: baseUrl ?? OLLAMA_BASE_URL,
      })(model);
    case "custom":
      return createOpenAI({ apiKey, baseURL: baseUrl })(model);
    case "hosted":
      // Seam for future Introspect-managed proxy
      throw new Error(
        "Introspect Hosted is not yet available. Please choose a different provider in Settings.",
      );
    default:
      // Unknown provider — try as OpenAI-compatible with whatever base URL is set
      return createOpenAI({ apiKey, baseURL: baseUrl })(model);
  }
}

// ---------------------------------------------------------------------------
// Main entrypoints
// ---------------------------------------------------------------------------

/** Returns model + mode in one DB call. Prefer this over getModel() in routers. */
export async function resolveAi(
  db: UserDb,
): Promise<{ model: LanguageModel; mode: StructuredMode }> {
  const config = await getAiConfig(db);
  return { model: buildModelFromConfig(config), mode: config.mode };
}

/** Backward-compatible helper — kept for the streaming chat route. */
export async function getModel(db: UserDb): Promise<LanguageModel> {
  const { model } = await resolveAi(db);
  return model;
}

// ---------------------------------------------------------------------------
// Test connection — used by the settings testConnection mutation
// ---------------------------------------------------------------------------

export async function testConnection(config: AiConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const model = buildModelFromConfig(config);
    await generateText({
      model,
      prompt: "Reply with the single word: ok",
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
