# Session: Routines + Day Timeline (2026-07-12)

Branch: `feature/phase-4-routines` (off develop). Plan interview conducted with grill-me; decisions locked before code.

## Vision (user's words, condensed)

Two features on one data foundation:

1. **Routines** — Atomic-Habits habit stacking. Tap "Start morning routine" at 7am; the app stopwatches each step from the end of the previous one; tap to advance. Some habits need a *minimum* time (don't brush teeth in 30s), some a *maximum* (don't shower 30 min). Chains grow gradually (teeth → water → workout) and apply to any recurring block (nightly, pre-workout, weekend chores). Swap/remove steps freely; AI suggests what to chain next based on who the user is.
2. **Day timeline** — every check-in and routine run becomes a calendar-style time block so user + AI see where time goes and what's unaccounted. Long-term: mirror to any external calendar (Google first); patterns in the data ("scrolls 90 min after waking") power routine recommendations.

## Locked decisions

- Introspect DB owns all data; external calendars are a phase-2 **mirror**, never the source of truth. `timeline_events` has stable ids for future sync (`externalId`/`syncedAt` to be added then).
- Run flow: tap-to-advance stopwatch; countdown when maxSeconds set; per-step Skip; whole-run Abandon; partial runs logged honestly (statuses per step).
- Steps are new entities with optional `habitId` link to extracted habits → completions feed `habit_occurrences` streaks (deduped ~1/day) and ground AI suggestions.
- Min AND max seconds per step, independent and optional.
- Scheduling (daysOfWeek + anchorMinutes) drives reminders/missed detection only; starting is always manual.
- Check-in timeline block spans previous entry → now, capped at 12h. Gaps = "unaccounted", a distinct category, never assumed wasted.
- Server timestamps are the timing source of truth; the run screen clock is render-only (refresh-proof via `routines.activeRun`).

## What was built

- Tables: `routines`, `routine_steps`, `routine_runs`, `step_runs`, `timeline_events` — DDL synced in schema.ts + signup `USER_DB_INIT_SQL` + ensure-tables.ts (all three must stay in sync).
- Routers: `routines` (CRUD, step ops, run lifecycle, `suggestSteps` AI, `runHistory`), `timeline.day` (client passes local-day bounds; gaps computed on the fly).
- `journal.create` now writes the check-in timeline block.
- UI: `/routines` (builder + refresh-proof run screen), `/day` (timeline + accounted/unaccounted totals), nav links.
- AI: `src/server/ai/routine-suggest.ts` (generateStructured, 3 suggestions grounded in habits/profile/wiki); chat context now includes 7-day routine adherence + last-24h timeline + unaccounted hours.
- Cron: daily missed-routine push ("X didn't happen yesterday"), UTC day boundaries (v1 approximation; precise anchor-time reminders need paid cron/QStash — phase 2).

## Verification

Server-side caller script exercised the full lifecycle against a real local SQLite DB: 30 assertions passed (CRUD, reorder, double-start guard, complete/skip/abandon, timeline events for completed steps only, habit streak bump with dedupe, check-in spans, day gaps, position re-packing, history preserved after delete). UI requires a signed-in session — manual click-through pending.

## Phase 2 (deferred)

Calendar mirroring (Google OAuth push, ICS feed), reading external events into /day, AI pattern mining over accumulated timeline, manual time-entry UI if gaps prove annoying, precise anchor-time reminders.
