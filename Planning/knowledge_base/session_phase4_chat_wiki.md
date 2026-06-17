# Session Log: Phase 4 — Reflect Chat + Wiki Knowledge Graph

**Date:** 2026-06-06
**Branch:** `feature/phase-2-journal-entry`

---

## What Was Built

### Feature: "Reflect" — Profile-Aware Chat with Auto-Updating Wiki

A persistent, AI-maintained chat page at `/chat` (nav label: "Reflect") where the user can:
1. **Learn about themselves** — AI reflects patterns back using their full profile context
2. **Help the AI learn about them** — AI asks targeted questions to fill gaps in the profile

The AI automatically updates the user's wiki-style knowledge graph after every chat turn. Zero user action required.

---

## Product Philosophy Decisions Made

- **Hands-off profile building**: The AI updates the wiki silently after each message. No "save this" button.
- **Free-form, not mode-switching**: The user doesn't pick a mode. They just talk. The AI adapts.
- **Wiki = knowledge graph**: Each wiki page is a node; edges are directed relationships. Both stored in SQLite.
- **Singleton user for now**: All wiki pages scoped to one user (`id = "default"` pattern, same as `profile` and `settings`). Multi-user will require adding `userId` columns and per-user DB separation later.
- **Streaming responses**: Route uses `toTextStreamResponse()` (AI SDK v6 plain text stream). Client uses manual `fetch` + `ReadableStream` reader — chosen over `useChat` because AI SDK v6 changed the `useChat` API to use `UIMessage` / `TextStreamChatTransport` which doesn't map cleanly to the simple `{ role, content }` format used everywhere else in this codebase.

---

## New Database Tables

### `introspect_wiki_pages`
| Column | Type | Notes |
|--------|------|-------|
| `slug` | text PK | kebab-case unique identifier, e.g. `morning-routine` |
| `title` | text | Human-readable page title |
| `category` | text | `identity` \| `habits` \| `blockers` \| `goals` \| `thinking` \| `context` |
| `content` | text | Markdown prose (2–6 sentences) |
| `tags` | text | JSON: `string[]` |
| `updatedAt` | integer | Unix timestamp |

### `introspect_wiki_edges`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `fromSlug` | text | Source page slug |
| `toSlug` | text | Target page slug |
| `relation` | text | e.g. `blocks`, `supports`, `is-part-of`, `conflicts-with`, `leads-to` |

### `introspect_chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `role` | text | `user` \| `assistant` |
| `content` | text | Full message text |
| `createdAt` | integer | Unix timestamp |

---

## New Files

### `src/server/ai/chat.ts`
Two exported functions:
- **`buildChatContext(wikiPages, wikiEdges, habits, recentEntries)`** — assembles context string for the system prompt: wiki profile, graph edges, habit list, recent journal entries.
- **`extractWikiUpdates(model, userMessage, assistantResponse, existingPages)`** — second AI call (tool use) that reads the conversation turn and returns `{ upsertPages[], upsertEdges[] }` for DB persistence.

### `src/app/api/chat/route.ts`
Next.js POST route handler:
1. Accepts `{ messages: { role, content }[] }`
2. Loads wiki, habits, entries from DB in parallel
3. Calls `streamText` with full context in system prompt
4. `onFinish`: saves user + assistant messages, fires `extractWikiUpdates` in background
5. Returns `toTextStreamResponse()` — plain text chunked stream

### `src/server/api/routers/wiki.ts`
tRPC router with:
- `wiki.pages` — all wiki pages (tags parsed from JSON)
- `wiki.edges` — all graph edges
- `wiki.page({ slug })` — single page
- `wiki.chatHistory({ limit })` — recent messages oldest-first, for client hydration

### `src/app/_components/chat-view.tsx`
Client component:
- Loads history from `wiki.chatHistory` on mount, hydrates local state once
- Manual streaming fetch (`fetch` + `ReadableStream` reader) — accumulates chunks into assistant message in real time
- Wiki profile panel (collapsible) shows all pages with category color tags
- Starter prompts when chat is empty
- Refetches wiki pages 3s after each AI response completes (gives background wiki update time to finish)

### `src/app/chat/page.tsx`
Page shell at `/chat`. Title: "Reflect".

---

## AI SDK v6 Gotchas Discovered

- `toDataStreamResponse()` does **not** exist in this version — use `toTextStreamResponse()` for plain text streams
- `useChat` from `@ai-sdk/react` v3 uses `UIMessage` with `parts[]` arrays and `sendMessage()` — not the old `{ handleSubmit, input, isLoading }` API
- `TextStreamChatTransport` is the correct transport for `toTextStreamResponse()` endpoints if using the new `useChat`, but the format mismatch with the rest of the codebase made manual fetch cleaner
- `findLast` on arrays requires `lib: es2023+` in tsconfig — use `[...arr].reverse().find()` instead

---

## Data Flow

```
User types message
  → POST /api/chat { messages }
  → Load wiki pages + edges + habits + entries (parallel DB queries)
  → buildChatContext() → system prompt
  → streamText() with full message history
  → toTextStreamResponse() → client reads chunks → updates assistant bubble
  → onFinish:
      → insert user + assistant into chat_messages
      → extractWikiUpdates() (background, non-blocking)
          → upsert wiki_pages rows
          → insert wiki_edges rows
  → client refetches wiki 3s later → profile panel updates
```

---

## What's Next (Planned)

- **Mental model update**: `planning/mental-model.html` needs new cards for wiki tables, chat route, and the Reflect page
- **Multi-user**: Add `userId` column to `wiki_pages`, `wiki_edges`, `chat_messages` when auth is added
- **Graph visualization**: Render the wiki graph as an interactive node graph on the Reflect page
- **Profile seeding**: On first chat open, trigger an initial wiki build from existing entries + habits (similar to `insights.refresh`)
