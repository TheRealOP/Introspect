# 🔐 Auth, Per-User Databases & Deployment

Added in **Phase 5**. Covers email/password authentication, the per-user Turso database model, and how to deploy to Vercel.

---

## 🏗️ Architecture Overview

Introspect uses a **two-database model**:

| Database | Purpose | Location (dev) | Location (prod) |
|---|---|---|---|
| **Users DB** | Central auth store — email, hashed password, per-user DB credentials | `file:./users.db` | Turso remote (`libsql://…`) |
| **Per-user DB** | All app data — entries, habits, nudges, profile, wiki, chat | `file:./user-{id}.sqlite` | Turso remote (provisioned on signup) |

Every user gets a completely isolated database. Their data never touches another user's rows.

---

## 🔑 Auth Stack

- **NextAuth v5 (Auth.js beta)** — App Router native, JWT strategy
- **Credentials provider** — email + bcrypt password (no OAuth required)
- **bcryptjs** — password hashing with cost factor 12
- **JWT session** — stores `dbUrl` and `dbAuthToken` so every request can connect to the right user DB without an extra DB lookup

### Session data shape
```ts
// In the JWT and session:
{
  user: {
    id: string
    email: string
    dbUrl: string       // e.g. "libsql://introspect-abc123.turso.io"
    dbAuthToken: string // Turso auth token for this user's DB
  }
}
```

This is extended in `src/types/next-auth.d.ts`.

---

## 📁 New Files (Phase 5)

| File | Purpose |
|---|---|
| `src/server/auth.ts` | NextAuth v5 config — Credentials provider, JWT/session callbacks |
| `src/server/db/users-client.ts` | Central users DB — `getUserByEmail`, `createUser`, `initUsersDb` |
| `src/server/db/index.ts` | Now exports `createUserDb(url, token)` factory (was a singleton `db`) |
| `src/server/turso.ts` | `provisionUserDb(userId)` — calls Turso Platform API in prod, local file in dev |
| `src/types/next-auth.d.ts` | TypeScript module augmentation for Session/JWT types |
| `src/middleware.ts` | Route protection — redirects unauthenticated requests to `/auth/signin` |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler (`GET` + `POST`) |
| `src/app/api/signup/route.ts` | Signup endpoint — provisions Turso DB, seeds schema, creates user record |
| `src/app/auth/signin/page.tsx` | Sign-in page (matches dark purple theme) |
| `src/app/auth/signup/page.tsx` | Sign-up page (auto signs-in after account creation) |

---

## 🔄 Signup Flow (step by step)

```
User submits email + password
  ↓
POST /api/signup
  ↓
initUsersDb()          — CREATE TABLE IF NOT EXISTS users (idempotent)
getUserByEmail()       — check for duplicate
  ↓
provisionUserDb(id)
  ├── prod:  Turso Platform API → create DB → create auth token → return { dbUrl, dbAuthToken }
  └── dev:   return { dbUrl: "file:./user-{id}.sqlite", dbAuthToken: "" }
  ↓
createUserDb(dbUrl, dbAuthToken)
  + run CREATE TABLE IF NOT EXISTS for all 9 app tables
  ↓
createUser({ id, email, passwordHash, dbUrl, dbAuthToken })
  — saved to central users DB
  ↓
Client: signIn("credentials", { email, password })
  — NextAuth verifies → puts dbUrl/dbAuthToken in JWT
  ↓
Redirect to /
```

---

## 🔄 Sign-in Flow

```
User submits email + password
  ↓
NextAuth Credentials provider authorize()
  ↓
getUserByEmail(email)        — fetch from central users DB
bcrypt.compare(password, hash)
  ↓
Returns { id, email, dbUrl, dbAuthToken } to NextAuth
  ↓
jwt() callback              — copies dbUrl/dbAuthToken into JWT token
session() callback          — copies from token into session.user
  ↓
Session cookie set — all subsequent requests carry the DB credentials
```

---

## 🗄️ tRPC Context (per-request DB)

`src/server/api/trpc.ts` now calls `auth()` on every tRPC request:

```ts
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  if (!session?.user?.dbUrl) throw new TRPCError({ code: "UNAUTHORIZED" });
  const db = createUserDb(session.user.dbUrl, session.user.dbAuthToken);
  return { db, session, ...opts };
};
```

`createUserDb` caches connections in a `Map<url, DrizzleInstance>` so the same user hitting the same Lambda instance reuses the connection.

---

## 🛡️ Route Protection

`src/middleware.ts` uses NextAuth's `auth()` export:

```ts
export default auth((req) => {
  const isPublic =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/signup");

  if (!req.auth && !isPublic) {
    return Response.redirect(new URL("/auth/signin", req.url));
  }
});
```

All routes are protected except `/auth/*`, `/api/auth/*`, and `/api/signup`.

---

## 🏭 Turso Platform API (production provisioning)

`src/server/turso.ts` calls two Turso REST endpoints on signup:

1. `POST /v1/organizations/{org}/databases` → creates the database
2. `POST /v1/organizations/{org}/databases/{name}/auth/tokens?expiration=never` → creates a permanent auth token

The DB URL is `libsql://{hostname}` from the creation response.

In development (no `TURSO_API_TOKEN`), it returns a local file path instead — no API call.

---

## 🌍 Environment Variables

### Required

| Variable | Description |
|---|---|
| `AUTH_SECRET` | NextAuth JWT signing key. Generate: `openssl rand -base64 32` |
| `USERS_DATABASE_URL` | Central users DB. Dev: `file:./users.db`. Prod: Turso URL |

### Optional (prod only)

| Variable | Description |
|---|---|
| `USERS_DATABASE_AUTH_TOKEN` | Auth token for Turso users DB (required for remote URL) |
| `TURSO_API_TOKEN` | Turso Platform API token for provisioning user databases |
| `TURSO_ORGANIZATION` | Turso organization slug |

---

## 🚀 Vercel Deployment

### Platform choice

**Hobby tier is fine to start.** The key limit is the **10-second serverless function timeout**. Groq AI calls typically take 2-4s so this is not an issue. If slower providers or longer prompts cause timeouts, upgrade to Pro and add `export const maxDuration = 30` to the tRPC route handler.

### Step-by-step deploy checklist

```
1. turso db create introspect-users
   → copy the DB URL and auth token

2. Get a Turso Platform API token (for provisioning user DBs on signup)
   turso auth token
   → copy as TURSO_API_TOKEN

3. Set env vars in Vercel dashboard:
   AUTH_SECRET=<openssl rand -base64 32>
   USERS_DATABASE_URL=libsql://introspect-users-<org>.turso.io
   USERS_DATABASE_AUTH_TOKEN=<token>
   TURSO_API_TOKEN=<platform-api-token>
   TURSO_ORGANIZATION=<org-slug>
   GROQ_API_KEY=<your-key>

4. Push to Vercel (git push or Vercel CLI)

5. Visit /auth/signup — first signup provisions a fresh Turso DB
   automatically and seeds all 9 app tables.
```

### What Vercel does automatically
- Detects Next.js 15, sets up ISR/RSC/App Router correctly
- Each API route and tRPC call runs as a serverless function
- The central users DB connection is established per cold-start
- Per-user DB connections are cached in the Lambda instance's `Map` for the duration of the warm period

---

## 🔒 Security notes

- Passwords are hashed with bcrypt cost factor 12 (never stored plain)
- The users DB auth token is never exposed to the client
- Per-user DB auth tokens live only in the server-side JWT (HTTP-only cookie) — never in `localStorage` or client JS
- The middleware blocks all non-public routes before any page or API handler runs
