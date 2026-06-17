# Session: Production Launch (2026-06-17)

This session covers everything done to take Introspect from local development to a live production deployment.

---

## What Was Done

### 1. Production Build Verified
Ran `npm run build` — passed clean with zero errors. All 16 routes compiled successfully including all auth, app, and API routes.

### 2. Turso Infrastructure Set Up

**Central users DB** (stores all user accounts):
- Name: `introspect-users`
- URL: `libsql://introspect-users-therealop.aws-us-east-2.turso.io`
- Group: `default` (aws-us-east-2)
- Org: `therealop`

**Per-user DB for Ojas's personal account:**
- Name: `introspect-704da976`
- URL: `libsql://introspect-704da976-therealop.aws-us-east-2.turso.io`
- User ID: `704da976-1bf9-4d61-9475-b238138222df`

### 3. Env Vars Configured

All production secrets saved to `.env.production.local` (gitignored) and set in Vercel dashboard:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth JWT signing key |
| `USERS_DATABASE_URL` | Central Turso users DB URL |
| `USERS_DATABASE_AUTH_TOKEN` | Auth token for central users DB |
| `TURSO_API_TOKEN` | Turso Platform API token (provisions per-user DBs on signup) |
| `TURSO_ORGANIZATION` | `therealop` |
| `GROQ_API_KEY` | AI provider for habit extraction and insights |

### 4. Code Committed and Merged to Main

All phase 2-5 work was uncommitted on `feature/phase-2-journal-entry`. This session:
- Committed 62 files (8,499 insertions) as a single commit
- Pushed branch to GitHub
- Opened and merged PR #1 → `main`
- Fast-forward merged `main` → `develop` to keep branches in sync

### 5. Personal Account Seeded into Production

Ojas's local dev account (`ojaspolakhare@gmail.com`) was migrated to production:
- A dedicated Turso DB was provisioned (`introspect-704da976`)
- All 9 app tables were created in the user DB
- The central users DB was initialised with the `users` and `verification_tokens` tables
- The user record was inserted with the correct prod `dbUrl` and `dbAuthToken`
- Password reset (bcrypt hash, cost factor 12)
- Account is marked as email-verified

---

## Production State After This Session

- **Vercel**: Connected to GitHub `main` branch, auto-deploys on push
- **Central DB**: Turso `introspect-users` — initialised with schema, 1 user account
- **User DB**: Turso `introspect-704da976` — all 9 tables seeded, empty data
- **Git**: `main` and `develop` both at commit `b7fff31` (PR #1 merged)
- **Local**: `feature/phase-2-journal-entry` branch, local `users.db` still present for dev use

---

## How New Users Sign Up in Production

The `/api/signup` route handles everything automatically:
1. Calls `provisionUserDb(id)` → Turso Platform API creates a new DB
2. Seeds all 9 app tables in the new DB
3. Saves the user record (with `dbUrl` + `dbAuthToken`) to the central users DB
4. Sends a verification email via Resend

No manual steps needed for new signups — the flow is fully automated.

---

## Key Files for Deployment Reference

| File | Purpose |
|---|---|
| `.env.production.local` | Local copy of all production secrets (gitignored) |
| `src/server/turso.ts` | Turso Platform API provisioning logic |
| `src/server/db/users-client.ts` | Central users DB queries |
| `src/app/api/signup/route.ts` | Full signup flow including DB provisioning and schema seeding |
| `src/middleware.ts` | Route protection — all routes except `/auth/*` require a session |
