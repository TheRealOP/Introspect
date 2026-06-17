# Product Decisions

Core product decisions made during development. Updated as the product direction evolves.

---

## Email/Password Auth (not OAuth)

**Decided:** 2026-06-07
**Phase:** Phase 5

### Decision
Authentication uses **email + bcrypt password** via NextAuth v5 Credentials provider. Google OAuth is explicitly deferred.

### Why
Email/password is simpler to set up and doesn't require a Google Cloud project or OAuth consent screen approval. For a personal productivity tool, the friction of OAuth sign-up doesn't add meaningful value at this stage.

### Google OAuth — still planned
When Google Calendar integration ships (see below), Google OAuth will be added alongside the existing Credentials provider. The architecture is already compatible — NextAuth supports multiple providers simultaneously.

---

## Per-User Turso Databases

**Decided:** 2026-06-07
**Phase:** Phase 5

### Decision
Every user gets a **completely isolated Turso database** provisioned automatically on signup via the Turso Platform API. There is no shared multi-tenant database with user-ID partitioning.

### Why
- Full data isolation — no risk of a query leaking another user's data
- Each user's DB scales independently
- The wiki, habit graph, and AI profile are deeply personal — isolation matches the product's "your own private mind" framing
- Turso's free tier allows 500 databases — more than enough for initial growth

### Dev fallback
When `TURSO_API_TOKEN` is not set (local development), the signup route creates a local `file:./user-{id}.sqlite` instead. No API call needed.

---

## Vercel Hobby for Deployment

**Decided:** 2026-06-07
**Phase:** Phase 5

### Decision
Deploy to **Vercel Hobby** (free tier) to start.

### Why
The only meaningful limit is the 10-second serverless function timeout. Groq AI calls (habit extraction, insights) typically complete in 2-4 seconds, well within budget. If slower AI providers or larger context windows cause timeouts, upgrade to Pro and add `export const maxDuration = 30` to the tRPC route handler — a one-line change.

---

## Nudges replaced by Mini-Plans

**Decided:** 2026-06-05
**Phase:** Phase 3 (updated in place)

### Decision
The 4 AI-generated "2-minute nudge" micro-actions have been replaced by **3 AI-generated mini-plans** — short, concrete statements of intent for what the user will do until their next check-in.

The user can also **write their own custom plan** instead of picking from the AI suggestions.

The committed plan (AI-selected or custom) is stored in `entries.plan` (new column). AI suggestions are still stored in the `nudges` table for history and preference profiling.

### What changed
- `extractFromEntry` now returns `plans` (3 items, 1-2 sentences each, ≤30 words) instead of `nudges` (4 micro-actions)
- New `selectPlan` mutation: picks an AI suggestion + writes to `entries.plan`
- New `setPlan` mutation: saves a user-written custom plan to `entries.plan`
- UI: "Pick your 2-min nudge" section replaced with "What's your plan until the next check-in?" with AI suggestions + "Write my own plan" textarea

### Why
The 2-minute micro-action framing felt too prescriptive and low-level. Users want to set a **personal intention for the next session**, not be told to do a specific small act. Mini-plans let the user own their next steps — the AI offers grounded suggestions, but the user can always articulate their own plan.

---

## Journal framing — Activity Check-In Tracker

**Decided:** 2026-06-04  
**Phase:** Phase 2 (implemented as static copy)

### Decision
Introspect is an **activity check-in tracker**, not a reflective journal.

The mental model:
- You live your life, then you check in: *"What did I do in the past hour / few hours / since last check-in?"*
- Each check-in is a timestamped log of activities (e.g. "Woke up, did morning run, made coffee, read for 30 min").
- Over time, these logs build a history that the AI can mine for habit patterns (Phase 3+).

### What this means in practice
- The textarea prompt says **"What have you done since your last check-in?"** — not "What's on your mind?".
- Past entries surface as a **Check-in log**, not a journal or diary.
- The product tagline is **"Check in. Track what you do. Spot your habits."**

---

## Planned: Google Auth + Google Calendar Integration

**Noted:** 2026-06-05
**Phase:** Deferred (post-Phase 2/3)

### Decision
Authentication will use **Google OAuth** (via NextAuth/Auth.js v5). Google was chosen specifically because the product roadmap includes **Google Calendar integration** — storing the OAuth access token at sign-in means we can later read/write calendar events without additional OAuth flows.

### What this means in practice
- Auth gate: a single Google account protects the app (personal-use tool).
- Access token stored at sign-in for later Calendar API calls.
- Multi-user data isolation is deferred — scope all data to one user for now.
- Calendar integration goal: surface check-in prompts based on upcoming events, or log check-ins as calendar notes.

### Implementation notes when ready
- Package: `next-auth@beta` (Auth.js v5 — App Router native)
- Provider: `GoogleProvider` with `scope: "openid email profile https://www.googleapis.com/auth/calendar"`
- Add `sessions` or JWT adapter; no new DB table needed for personal single-user mode.
- All tRPC procedures stay `publicProcedure` — protected by middleware or layout-level redirect.

---

### Deferred: Dynamic, time-of-day-tailored prompts
The long-term product goal is for the check-in prompt to be **contextually aware**:
- Morning: *"You woke up — what's your morning routine been like?"*
- Afternoon: *"It's been 4 hours since your last check-in. What have you been up to?"*
- Evening: *"End-of-day check-in — walk me through your afternoon."*

This requires knowing the user's last check-in time, time of day, and possibly a lightweight profile of their typical schedule. **Not implemented in Phase 2** — static copy ships first; dynamic prompts are a Phase 4/5 product feature.
