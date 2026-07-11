# Handoff: Introspect Color Theme Refresh

## Overview
New light/dark color theme for the Introspect app (check-in, habits, log, insights, reflect, settings). Replaces the current black-page/white-card look with a cohesive palette in both modes, plus a light/dark toggle. No UX/flow changes — layout, copy, and interactions are unchanged.

## About the Design Files
The bundled `.dc.html` files are **design references** built in HTML, not production code to copy directly. They render live in a browser and demonstrate the intended visual result. The task is to **recreate this theme in the actual codebase** (Next.js/React, using `src/styles/globals.css`, Tailwind, and the existing component files like `journal.tsx`, `nav.tsx`) — not to ship the HTML.

## Fidelity
**High-fidelity.** All colors below are final. Typography, spacing, radii, and shadows shown are intended as real values, not placeholders.

## Files
- `Introspect Full App Theme.dc.html` — all 6 screens (Check in, Habits, Log, Insights, Reflect, Settings) in one shell with a working light/dark toggle. This is the primary reference.
- `Introspect Home Redesign.dc.html` — earlier exploration of the check-in screen only (kept for history; superseded by the full-app file for anything beyond check-in).

Open either file directly in a browser to interact with it (toggle theme, switch tabs).

## Design Tokens

### Base colors (literal, same across both files)
Light mode:
- `--text: #040e11`
- `--background: #f7fcfd`
- `--primary: #35aed0`
- `--secondary: #e58bbc`
- `--accent: #db7866`

Dark mode:
- `--text: #eef8fb`
- `--background: #15191b`
- `--primary:` `#2fa9ca` blended 48% toward `#15191b` (i.e. `color-mix(in srgb, #2fa9ca 48%, #15191b 52%)`) — softened so it doesn't glow against the dark bg
- `--secondary:` `#741a4c` blended 80% toward `#eef8fb` (`color-mix(in srgb, #741a4c 80%, #eef8fb 20%)`) — lifted slightly so it's legible on dark
- `--accent: #993524`

### Derived tokens (computed from the base 5 via CSS `color-mix`, same formula both modes unless noted)
- `surface` (card/input bg): `color-mix(in srgb, background 95%, primary 5%)` — light; `91%/9%` in dark
- `border`: `color-mix(in srgb, primary 30%, background 70%)` — light; `38%/62%` in dark
- `text-muted`: `color-mix(in srgb, text 68%, background 32%)`
- `text-faint`: `color-mix(in srgb, text 44%, background 56%)`
- `accent-soft` (tinted panel bg, e.g. plan section): `color-mix(in srgb, background 84%, primary 16%)` — light; `95%/5%` in dark (kept subtle in dark to avoid mud)
- `secondary-soft`: `color-mix(in srgb, background 80%, secondary 20%)` — light; `65%/35%` in dark
- `accent-border-strong` (colored borders/shadows on buttons & chips): `color-mix(in srgb, primary 55%, background 45%)` — light; `68%/32%` in dark
- `chip-bg`: `color-mix(in srgb, background 90%, primary 10%)` — light; `84%/16%` in dark
- `negative-soft` (negative-sentiment chip/card bg): `color-mix(in srgb, background 88%, accent 12%)` — light; `78%/22%` in dark
- `negative-border`: `color-mix(in srgb, accent 45%, background 55%)`
- `plan-btn-bg` (dark mode only — plan suggestion buttons need to sit closer to bg than generic `surface`): `color-mix(in srgb, background 88%, primary 12%)`
- `on-accent` (text on solid primary buttons): `#ffffff` both modes

Exact color-mix formulas are in `Introspect Full App Theme.dc.html`'s `palette()` method (search `deriveTones`/`palette`) — copy those percentages verbatim into the app's token derivation so both files stay in sync.

## Typography
- Font: Inter (400/500/600/700/800 weights loaded), fallback `ui-sans-serif, sans-serif`
- App title: 40px / weight 800 / letter-spacing -0.02em
- Subtitle: 14px / weight 400
- Nav tabs: 13px / weight 500 (inactive) or 700 (active)
- Section labels (uppercase eyebrow): 10.5px / weight 700–800 / letter-spacing 0.08em
- Body/entry text: 13–13.5px / line-height 1.6
- Meta text (counts, dates): 11–11.5px

## Layout
- Page: full-height, centered column, max-width 640px, 64px top/bottom padding, 24px gap between header/nav/content
- Cards: 16px border-radius, 16px padding, 1.5px border, 10px internal gap
- Buttons/chips/badges: pill or 8–12px radius depending on size (see below)
- Chat bubbles: 16px radius, 80% max-width, right-aligned (user) / left-aligned (assistant)

## Components (spec)
- **Toggle theme button**: pill, `secondary-soft` bg, `secondaryText` color (derived: `color-mix(secondary 92%, text 8%)`), 1.5px border, label reads "Dark mode" / "Light mode" depending on current state
- **Active nav tab**: solid `primary` bg, white text, weight 700, colored drop shadow using `accent-border-strong`
- **Inactive nav tab**: transparent, `text-faint` color
- **Primary button** (e.g. "Log check-in", "Send"): solid `primary` bg, white text, weight 700, colored shadow (`accent-border-strong`)
- **Ghost button** (e.g. "Analyze all entries"): transparent bg, 1.5px `border`, `text-muted` color
- **Danger/tiny buttons** (Habits screen: Delete): transparent, border in `negative-border`, text in `accent`
- **Plan section** (check-in): background `accent-soft`, 1.5px `border`; each suggestion button uses `plan-btn-bg` (dark) / `surface` (light) with a `accent-border-strong` border — this was explicitly tuned to avoid looking "muddy" in dark mode
- **Chips** (habits spotted): positive chip uses `chip-bg` + `accent-border-strong` border; negative chip uses `negative-soft` + `negative-border`
- **Habit cards** (Habits tab): dot indicator colored `primary` (positive) or `accent` (negative); sentiment pills use the badge pattern below
- **Badges** (Insights: aware/unaware, want to build/remove): pill, 3px/9px padding, 10.5px/weight 700, colored per meaning — aware/build use primary-tinted (`accent-soft`/`chip-bg` + `accent-border-strong`), unaware uses `negative-soft`/`negative-border`, remove uses `secondary-soft`/`secondaryText`
- **AI banner** (Insights/Reflect top bar): `surface` bg, 1.5px `border`, flex row space-between
- **Summary/Suggestions/Nudge cards** (Insights → AI Profile): distinct tints — summary = `accent-soft`, suggestions = `secondary-soft`, nudge = `negative-soft` w/ `negative-border` — so the three reads are visually distinct at a glance
- **Chat bubbles**: user bubble solid `primary` bg + white text; assistant bubble `chip-bg` + `text`
- **Settings switch (on state)**: track solid `primary`, white thumb with soft shadow
- **Settings select field**: `surface` bg, 1.5px `border`, `text` color

## Interactions & Behavior
- Theme toggle: click button in header, flips `light`/`dark` state instantly (add a smooth `background-color`/`color` transition, ~200–250ms, on page + card containers)
- Nav tabs: click to switch screens, no page reload — same single-page tab pattern as the current app
- All other interactions (textarea focus, button hover, sentiment pill selection, chat send) are unchanged from current behavior — this handoff is visual only

## State Management
No new state beyond a `theme: "light" | "dark"` value, ideally persisted (e.g. `localStorage` + respecting `prefers-color-scheme` on first load) and applied via a `.dark` class on `<html>` or `<body>`, consistent with whatever theming approach (e.g. `next-themes`) the codebase already uses.

## Assets
None — no new icons or images introduced. Existing iconography/emoji-free style is preserved.
