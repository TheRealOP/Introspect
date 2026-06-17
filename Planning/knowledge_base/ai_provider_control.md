# AI Provider Control & Data Residency

## Why This Exists

Introspect is a journaling app. Private thoughts are sensitive. The product principle is that **users must control where their data goes** when AI features run. Many users are uncomfortable with OpenAI or Google processing their private journal entries.

This feature gives every user three tiers of choice:

| Tier | Description | Data flow |
|------|-------------|-----------|
| **A — Introspect Hosted** | Managed models (coming soon) | Entries processed on Introspect servers |
| **B — Bring Your Own** | User supplies an API key | Entries sent to provider of their choice |
| **C — Self-Hosted** | Ollama or any OpenAI-compatible endpoint | Entries never leave the user's device |

The **default provider is Ollama** (`llama3.1:8b` at `http://localhost:11434/v1`) — privacy-first out of the box.

---

## Architecture

### Provider Resolution (`src/server/ai/provider.ts`)

`getAiConfig(db)` → reads the per-user `settings` DB row → falls back to env vars → falls back to Ollama defaults.

`resolveAi(db)` → returns `{ model: LanguageModel, mode: StructuredMode }` in one DB call. **This is the main entrypoint for all routers.**

`buildModelFromConfig(config)` → switch on `provider`:
- `openai` → `@ai-sdk/openai`
- `anthropic` → `@ai-sdk/anthropic`
- `google` → `@ai-sdk/google`
- `groq` → `@ai-sdk/groq`
- `ollama` → `@ai-sdk/openai` with `baseURL = http://localhost:11434/v1`, key = `"ollama"`
- `custom` → `@ai-sdk/openai` with user-supplied `baseURL`
- `hosted` → throws a friendly "not yet available" error (seam for future proxy)

`testConnection(config)` → runs a minimal `generateText` ping to verify the config before saving.

### Settings Schema (`src/server/db/schema.ts` — `settings` table)

```
id        TEXT  PRIMARY KEY  (always "default" — singleton per user DB)
provider  TEXT               hosted | groq | openai | anthropic | google | ollama | custom
model     TEXT               model ID string
apiKey    TEXT               encrypted at rest by Turso; null for Ollama
baseUrl   TEXT               for ollama/custom endpoints
mode      TEXT               auto | tool | json
tier      TEXT               hosted | byo | selfhost
updatedAt INTEGER            unix timestamp
```

### Structured Output Fallback (`src/server/ai/structured.ts`)

All three AI features require structured output (habits+plans extraction, insights, wiki updates). These use tool calling by default — but many local/small models (Gemma, phi-2) don't support native tool calling.

`generateStructured(opts)` handles this transparently:
- `mode: "tool"` → `generateText` + forced tool call (existing behaviour)
- `mode: "json"` → `generateObject` JSON mode
- `mode: "auto"` (default) → try tool → if `UnsupportedFunctionality` error, fall back to `generateObject` → final fallback to plain `generateText` + regex JSON parse

This means users can use Gemma or other non-tool models and the app still works.

### AI Call Sites

| File | Function | Tool |
|------|----------|------|
| `src/server/api/routers/journal.ts` | `extractFromEntry` | habit extraction + 3 plans |
| `src/server/api/routers/insights.ts` | `buildInsights` | habit tags, summary, suggestions |
| `src/app/api/chat/route.ts` | `extractWikiUpdates` | wiki knowledge graph update |
| `src/app/api/chat/route.ts` | `streamText` | chat streaming (no tools needed) |

All routers now call `resolveAi(ctx.db)` to get both `model` and `mode` in one DB query, then pass `mode` to the AI function.

---

## Settings UI (`/settings` page)

Route: `src/app/settings/page.tsx`  
Component: `src/app/_components/ai-settings.tsx`

The page shows three tier cards (A/B/C), each with a one-line privacy/data-flow statement. Selecting a tier expands the config section with:

- Provider buttons (BYO: OpenAI/Anthropic/Google/Groq; Self-host: Ollama/Custom)
- Model ID field with presets per provider
- API key field (BYO only)
- Base URL field (Ollama/Custom only)
- Output mode selector (Auto / Tool calls / JSON mode)
- Compatibility warning when a known-weak model is entered (e.g. `gemma*`)
- **Test connection** button → calls `settings.testConnection` mutation → shows ✓ or error inline
- Save / Reset to default

The old inline panel in `insights.tsx` was replaced with a small banner showing the active provider + a "Change →" link to `/settings`.

---

## Weak Tool Model Warning

`isWeakToolModel(modelId)` in `structured.ts` (and duplicated in the UI) matches `/^gemma|^phi-2/i`. If the entered model matches this pattern and the user is in `tool` mode, a yellow warning banner suggests switching to `auto` or a tool-capable model (`qwen2.5:7b`, `llama3.1:8b`).

---

## Env Vars

```
AI_PROVIDER    = ollama (default)
AI_MODEL       = llama3.1:8b (default)
AI_BASE_URL    = http://localhost:11434/v1 (for ollama/custom)
GROQ_API_KEY   = optional
OPENAI_API_KEY = optional
ANTHROPIC_API_KEY = optional
GOOGLE_GENERATIVE_AI_API_KEY = optional
```

Per-user DB row wins over env vars.

---

## Hosted Tier Seam (Future)

`buildModelFromConfig` has a `case "hosted"` branch that throws a friendly "not yet available" error. When billing/proxy infrastructure is built, this branch will:
1. Validate the user's subscription/credits
2. Forward to an Introspect-managed model endpoint with a server-side key
3. Return a `LanguageModel` like any other provider

No caller changes needed.
