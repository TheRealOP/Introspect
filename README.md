# Introspect

A personal journaling and habit-tracking app with an AI layer. You log quick activity check-ins; the AI extracts habits from them, proposes micro-action nudges, chats about your entries, and builds long-term insights — all served from a per-user database so each account's data stays isolated.

## Stack

- **Next.js 15** (App Router) + React 19 + Tailwind CSS v4
- **tRPC 11** — typesafe API layer, all AI calls run server-side inside tRPC mutations
- **Drizzle ORM + libsql** — SQLite locally, [Turso](https://turso.tech) in production (one database per user, plus a central users/feedback DB)
- **NextAuth v5** — email/password credentials with email verification (Resend)
- **Vercel AI SDK v6** — provider-agnostic; Groq by default, with OpenAI / Anthropic / Google supported
- **Web Push** — reminder notifications via a service worker and a cron endpoint

## Getting Started

```bash
npm install
cp .env.example .env    # then fill in the values (see .env.example comments)
npm run db:push         # create the local SQLite schema
npm run dev             # http://localhost:3000
```

Local development needs no Turso account: `USERS_DATABASE_URL` and `DATABASE_URL` can point at local files, and per-user databases fall back to local files when the Turso API vars are unset.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run preview` | Build + start |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:generate` / `db:migrate` | Generate / run migrations |
| `npm run db:studio` | Browse the DB in Drizzle Studio |

## Project Layout

```
src/
├── app/               # Next.js App Router pages
│   ├── _components/   # Client components (journal, chat, habits, settings, …)
│   └── api/           # Route handlers: auth, chat streaming, cron, feedback, tRPC
├── server/
│   ├── ai/            # AI workflows: extraction, insights, chat, provider selection
│   ├── api/           # tRPC root + routers (journal, habits, insights, wiki, …)
│   ├── db/            # Drizzle schema, per-user DB factory, central users DB client
│   ├── auth.ts        # NextAuth v5 config
│   ├── email.ts       # Resend email sending
│   ├── push.ts        # Web push delivery
│   └── turso.ts       # Turso Platform API — provisions per-user databases
├── trpc/              # tRPC client/server helpers for React
└── middleware.ts      # Auth-gated routing
Planning/              # Product docs, phase plans, mental model
└── knowledge_base/    # Architecture / DB / API / AI docs — read this first
```

## Documentation

Deeper docs live in [`Planning/knowledge_base/`](Planning/knowledge_base/README.md) — architecture, database schema, tRPC setup, AI integration, and product decisions. The current-state mental model is at `Planning/mental-model.html`.

## Branching

- `main` — production only, merged via PR from `develop`
- `develop` — integration branch; all work lands here via PR
- `feature/*`, `fix/*`, `hotfix/*` — branch off `develop` (hotfixes off `main`)

Never push directly to `main` or `develop`.
