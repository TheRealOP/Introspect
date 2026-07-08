# Introspect Codebase Knowledge Base

Welcome to the **Introspect Codebase Knowledge Base**! This directory serves as a comprehensive, living documentation portal designed to help developers and AI agents fully understand every detail of the application's architecture, database, API layer, AI operations, and developer workflows.

---

## 📂 Directory Structure

This knowledge base is split into two formats to optimize both IDE browsing and rich visual learning:

```
Planning/knowledge_base/
├── README.md                # This file (getting started & index)
├── index.html               # 🚀 Interactive Visual Dashboard (Double-click to open!)
│
# Modular Articles (IDE friendly)
├── architecture.md          # High-level Next.js 15 app router & request flow
├── database.md              # LibSQL/SQLite schemas & Drizzle ORM layout
├── api.md                   # tRPC 11 server config, client hooks & timing middleware
├── ai_integration.md        # Google Gemini integration via Vercel AI SDK
├── workflows.md             # Git branching, dev commands, and gates
├── user_knowledge.md        # Ojas's phase gate results & understanding tracker
└── audit_2026-07-07.md      # Full project audit — findings by severity + fix checklist
```

---

## 🎨 The Interactive Dashboard (`index.html`)

To help visualize the linkages between files, databases, and APIs, we built a **premium visual knowledge graph dashboard**.

### 🌟 Key Features
* **Interactive SVG Graph**: Hover over and click nodes representing files, tables, and AI services. See connections light up with sleek neon glows.
* **Glassmorphic Wiki Reader**: Deep-dive into syntax-highlighted code, database schemas, and structured diagrams without leaving the visual graph.
* **Live Global Search**: Search across all articles instantly. The graph and article list filter dynamically based on your search terms.
* **100% Offline & Local**: Built entirely with client-side SVGs and self-contained styling/data. **No local server or build tools needed** — simply double-click the file to open it in your browser!

### 📥 How to Open
1. Locate `Planning/knowledge_base/index.html` in your file finder (Finder on Mac, Explorer on Windows).
2. Double-click to open it in Chrome, Safari, Firefox, or Edge.
3. *Alternative (VS Code)*: Right-click and choose **Open in Default Browser** or use a Live Server extension.

---

## 📝 Article Directory

If you prefer reading plain Markdown files, they are structured as follows:

### 1. [System Architecture & Flow](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/architecture.md)
* High-level software stack (Next.js 15, App Router, React 19, Tailwind CSS v4).
* The 5-stage project blueprint.
* Full request lifecycle tracing from the user's browser down to SQLite.

### 2. [Database Schema & Drizzle ORM](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/database.md)
* Two-database model: central users DB + per-user Turso DB (auto-provisioned at signup).
* Complete schema: 11 application tables (entries, habits, nudges, habitOccurrences, settings, profile, wikiPages, wikiEdges, chatMessages, pushSubscriptions, reminders).
* Drizzle ORM configuration and column-by-column breakdown.

### 3. [tRPC 11 API Layer](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/api.md)
* How tRPC connects Client and Server with total typesafety.
* Custom Context creation (`createTRPCContext`) injecting the Drizzle client.
* Latency Simulation: How our dev-only `timingMiddleware` automatically inserts a random `100ms - 500ms` delay to identify network waterfalls.

### 4. [AI Engine & Multi-Provider Integration](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/ai_integration.md)
* Vercel AI SDK v6 with multi-provider support: Groq (default), OpenAI, Anthropic, Google, Ollama, or custom endpoints.
* Structured output fallback chain (tool → JSON → text) via `src/server/ai/structured.ts` for robust extraction.
* **Workflow 1 (Habit Extraction)**: Tool calling or JSON mode with Zod schema validation on entry save.
* **Workflow 2 (Behavioral Insights)**: Text generation for long-term pattern analysis and executive coaching briefs.
* BYO-provider tiers (hosted/BYO/selfhost) and per-user API key settings.

### 5. [Developer & Branching Workflows](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/workflows.md)
* Branching strategies (`main`, `develop`, `feature/*`, `fix/*`, `hotfix/*`).
* The **Mental Model Gate** protocol (mandatory checklists before phase starts).
* Local setup, pushing database schemas, and building the production package.

### 6. [Product Decisions](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/product_decisions.md)
* Core product direction choices and the reasoning behind them.
* Journal framing: activity check-in tracker (not reflective journaling).
* Auth: email/password (not OAuth) — Google OAuth deferred.
* Per-user Turso databases — full data isolation per account.
* Deployment: Vercel Hobby tier.

### 7. [Full Project Audit — 2026-07-07](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/audit_2026-07-07.md)
* Complete codebase audit on `develop` (`ba3f300`), ordered by severity with fix checklists.
* **Critical**: new-signup settings schema mismatch (fix unmerged on `worktree-fix+settings-schema-columns`), middleware blocking the reminders cron + anonymous feedback + PWA manifest, a real user SQLite DB committed to the repo.
* **High**: never-expiring Turso token exposed to the browser session; no signup rate limiting / pre-verification DB provisioning.
* Medium/low findings, documentation drift list, and a recommended order of attack.

### 8. [Auth, Per-User Databases & Deployment](file:///Users/ojaspolakhare/Documents/GitHub/Introspect/Planning/knowledge_base/auth_and_deployment.md)
* Phase 5 implementation — NextAuth v5 Credentials provider, bcrypt, JWT session.
* Two-database model: central users DB + per-user Turso DB.
* Turso Platform API provisioning flow (with local file fallback in dev).
* Step-by-step Vercel deployment checklist.
* Security notes on password storage and token handling.

### Session Logs

Chronological records of working sessions and the decisions made in them:

* [session_launch.md](session_launch.md)
* [session_phase4_chat_wiki.md](session_phase4_chat_wiki.md)
* [web_push_reminders.md](web_push_reminders.md)
* [ai_provider_control.md](ai_provider_control.md)
* [session_repo_organization.md](session_repo_organization.md) — **2026-07-07** — repo cleanup (PR #8): user DBs untracked from git, real README, complete `.env.example`, scaffold `post` router removed.
