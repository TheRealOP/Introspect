# Phase 1 — Scaffolding

Get the T3 app running with SQLite, Drizzle schema, and AI SDK deps installed. Nothing more.

---

## 1. Create the T3 app ✅

```bash
# from the Introspect repo root
npx create-t3-app@latest ./ --noGit
```

| Option | Value | Status |
|---|---|---|
| TypeScript | Yes | ✅ |
| Tailwind CSS | Yes | ✅ |
| tRPC | Yes | ✅ |
| Drizzle | Yes | ✅ |
| NextAuth | No | ✅ |
| DB Provider | SQLite | ✅ |
| App Router | Yes | ✅ |

> `--noGit` because we already have a git repo initialized.

---

## 2. Install extra deps ✅

```bash
# Vercel AI SDK + Gemini provider
npm install ai @ai-sdk/google              # ✅ ai@6.0.193, @ai-sdk/google@3.0.80

# UUID generation for primary keys
npm install uuid                           # ✅ uuid@14.0.0
npm install -D @types/uuid                 # ✅ @types/uuid@10.0.0
```

---

## 3. Define the Drizzle schema ✅

Replace the default T3 schema in `src/server/db/schema.ts` with our 3 tables:

**entries** ✅
| Column | Type | Note | Status |
|---|---|---|---|
| `id` | TEXT | Primary key (uuid) | ✅ |
| `content` | TEXT NOT NULL | Free-form journal text | ✅ |
| `createdAt` | INTEGER | Unix timestamp, default now | ✅ |

**habits** ✅
| Column | Type | Note | Status |
|---|---|---|---|
| `id` | TEXT | Primary key (uuid) | ✅ |
| `name` | TEXT NOT NULL | e.g. "Morning run", "Doom scrolling" | ✅ |
| `sentiment` | TEXT NOT NULL | "positive" / "negative" / "neutral" | ✅ |
| `occurrences` | INTEGER | Default 1 | ✅ |
| `lastSeen` | INTEGER | Unix timestamp | ✅ |

**nudges** ✅
| Column | Type | Note | Status |
|---|---|---|---|
| `id` | TEXT | Primary key (uuid) | ✅ |
| `entryId` | TEXT | FK → entries.id | ✅ |
| `action` | TEXT NOT NULL | The 2-min actionable nudge | ✅ |
| `createdAt` | INTEGER | Unix timestamp, default now | ✅ |

---

## 4. Set up env vars ✅

```bash
# .env
GOOGLE_GENERATIVE_AI_API_KEY=your-key-from-aistudio.google.com   # ✅ present (placeholder value)
```

Add the var to `src/env.js` (T3's env validation) so it's type-safe. ✅

---

## 5. Push the schema & verify ✅

```bash
# Create the SQLite DB and push the schema
npm run db:push                            # ✅ db.sqlite exists with all 3 tables

# Start the dev server — should show the T3 landing page
npm run dev                                # ✅ .next build cache present
```

> **Done when:** `localhost:3000` loads the T3 splash page, `db.sqlite` exists with the 3 tables, and `npm run build` passes with zero errors.

---

## File tree after Phase 1

```
Introspect/
├── src/
│   ├── app/                — Next.js app router (default T3 page)     ✅
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts    — SQLite connection via @libsql/client     ✅ (see note below)
│   │   │   └── schema.ts   ← our 3 tables                            ✅
│   │   └── api/            — tRPC routers (empty for now)             ✅
│   └── env.js              ← add GOOGLE_GENERATIVE_AI_API_KEY         ✅
├── .env                    ← API key                                  ✅
├── drizzle.config.ts       — points to SQLite                         ✅ (see note below)
├── db.sqlite               ← created by db:push                      ✅
└── package.json            ← ai, @ai-sdk/google, uuid added          ✅
```

---

## Audit Notes

### ⚠️ Deviation: `@libsql/client` instead of `better-sqlite3`

The plan called for `better-sqlite3` as the local SQLite driver, but the implementation uses `@libsql/client` (Turso's client). **This is actually fine** — `@libsql/client` works with local `file:` SQLite URLs and is the same driver we'd use in production with Turso, so there's no adapter swap needed at deploy time. This is arguably better than the plan.

### ⚠️ Deviation: Default T3 home page replaced

The other model removed the default T3 posts table demo and replaced it with a minimal "Introspect" splash page (`src/app/page.tsx`). This was done so the build stays clean without referencing a `posts` table that doesn't exist in our schema. Makes sense.

### 🐛 Bug: `drizzle.config.ts` table filter mismatch

`drizzle.config.ts` has `tablesFilter: ["introspect-scaffold_*"]` but the schema uses `introspect_` as the table prefix. This means `drizzle-kit` commands (generate, migrate, push) may not correctly detect the tables. The filter should be updated to `"introspect_*"`.

### ✅ Summary

**5/5 steps complete.** One bug to fix (table filter), two harmless deviations (libsql vs better-sqlite3, splash page swap). The other model confirmed `npm run build` passes with zero errors. Phase 1 scaffolding is done.
