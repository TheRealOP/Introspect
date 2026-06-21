# Web Push Check-In Reminders

**Implemented:** 2026-06-20
**Branch:** feature/feedback-page

---

## What was built

Introspect now supports **Web Push notifications** that remind users to check in after N hours of inactivity. Notifications work on Android Chrome without installation; **iOS Safari requires the app to be installed as a PWA** (Add to Home Screen, iOS 16.4+) — the Settings UI enforces this gate automatically.

---

## Architecture

```
[Browser/PWA]
  → Settings → ReminderSettings component
  → requests Notification permission
  → registers /sw.js service worker
  → calls PushManager.subscribe (VAPID)
  → trpc push.subscribe → introspect_push_subscriptions (per-user Turso DB)
  → trpc reminders.update → introspect_reminders (per-user Turso DB)

[External cron, every ~15 min]
  → GET /api/cron/reminders?secret=CRON_SECRET
  → iterates central users table (USERS_DATABASE_URL)
  → for each user: opens their Turso DB, checks reminders + last entry timestamp
  → if inactivity >= intervalHours: sends Web Push via web-push + VAPID
  → on 410 Gone: deletes stale subscription
  → updates lastNotifiedAt to prevent spam

[Service worker: public/sw.js]
  → on 'push': showNotification(title, body, icon)
  → on 'notificationclick': focus open tab or openWindow("/")
```

---

## New files

| File | Purpose |
|---|---|
| `src/server/push.ts` | `sendPush()` helper wrapping `web-push`, initialized with VAPID |
| `src/server/api/routers/push.ts` | tRPC router: `subscribe`, `unsubscribe`, `isSubscribed` |
| `src/server/api/routers/reminders.ts` | tRPC router: `get`, `update` (singleton id="default") |
| `src/app/api/cron/reminders/route.ts` | Plain Next.js route handler (not tRPC) — iterates all users |
| `src/app/manifest.ts` | Next.js typed manifest route → `/manifest.webmanifest` |
| `public/sw.js` | Service worker for push + notification click |
| `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` | PWA icons (solid purple placeholders — replace with real art) |
| `src/app/_components/reminder-settings.tsx` | "use client" — toggle + interval picker, iOS gate |

## Modified files

| File | Change |
|---|---|
| `src/server/db/schema.ts` | +`pushSubscriptions`, +`reminders` tables |
| `src/server/api/root.ts` | registered `push`, `reminders` routers |
| `src/server/db/users-client.ts` | +`listUsers()` |
| `src/app/settings/page.tsx` | +Reminders section using `ReminderSettings` |
| `src/app/layout.tsx` | +apple-touch-icon, +manifest link |
| `src/env.js` | +VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, NEXT_PUBLIC_VAPID_PUBLIC_KEY |
| `next.config.js` | +`web-push` in serverExternalPackages |
| `tsconfig.json` | +`public` in exclude (SW is not Node/DOM TypeScript) |

---

## New env vars

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ojaspolakhare@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # same as VAPID_PUBLIC_KEY
CRON_SECRET=...                    # random secret guarding the cron endpoint
```

Generate VAPID keys with: `npx web-push generate-vapid-keys`

---

## DB tables (per-user Turso DB)

Both tables are created lazily via `CREATE TABLE IF NOT EXISTS` in the cron route — no migration script needed for existing users.

- **`introspect_push_subscriptions`** — one row per subscribed device (endpoint, p256dh, auth, userAgent)
- **`introspect_reminders`** — singleton `id="default"` (enabled, intervalHours, lastNotifiedAt, updatedAt)

---

## External scheduler (required — Vercel Hobby cron = once/day, too coarse)

Set up a cron job at **cron-job.org** (or GitHub Actions `schedule:`) to call:
```
GET https://<your-domain>/api/cron/reminders?secret=<CRON_SECRET>
```
every **15 minutes**. The endpoint is idempotent and returns `{ checked, notified }`.

If upgraded to Vercel Pro, add a `vercel.json` cron instead:
```json
{ "crons": [{ "path": "/api/cron/reminders?secret=CRON_SECRET", "schedule": "*/15 * * * *" }] }
```

---

## Testing locally

```bash
# 1. Generate keys (already done, in .env)
npx web-push generate-vapid-keys

# 2. Start dev server
npm run dev

# 3. Go to /settings → enable Reminders → accept permission prompt

# 4. Trigger manually
curl "http://localhost:3000/api/cron/reminders?secret=ci8k2mxp9vqrtf4wdlb7nhje3oas0u65"
# → { "checked": 1, "notified": 1 } if last entry is old enough

# 5. Wrong secret → 401
```

---

## Known limitations / future work

- PWA icons are solid purple placeholders — replace with real branded art
- iOS 16.3 and below: no Web Push support at all (graceful "not supported" message shown)
- `intervalHours` minimum is 1 hour — could add finer granularity (30 min, 15 min)
