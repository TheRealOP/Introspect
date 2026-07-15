import { sql } from "drizzle-orm";
import { sqliteTableCreator } from "drizzle-orm/sqlite-core";

export const createTable = sqliteTableCreator((name) => `introspect_${name}`);

export const entries = createTable("entries", (d) => ({
  id: d.text().primaryKey(),
  content: d.text().notNull(),
  plan: d.text(), // committed plan for the next check-in period (AI-picked or custom)
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

export const habits = createTable("habits", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  sentiment: d.text().notNull(),
  occurrences: d.integer().default(1),
  lastSeen: d.integer(),
}));

export const nudges = createTable("nudges", (d) => ({
  id: d.text().primaryKey(),
  entryId: d.text(),
  action: d.text().notNull(),
  selected: d.integer().default(0), // 1 when user picks this nudge
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

// One row per habit sighting — enables per-habit streak computation
export const habitOccurrences = createTable("habit_occurrences", (d) => ({
  id: d.text().primaryKey(),
  habitId: d.text().notNull(),
  entryId: d.text(),
  seenAt: d.integer().default(sql`(unixepoch())`),
}));

// Singleton (id = "default") — user's AI provider config; DB row wins over env
export const settings = createTable("settings", (d) => ({
  id: d.text().primaryKey(),
  provider: d.text(), // hosted | groq | openai | anthropic | google | ollama | custom
  model: d.text(),
  apiKey: d.text(),
  baseUrl: d.text(),
  mode: d.text(), // auto | tool | json — controls structured-output strategy
  tier: d.text(), // hosted | byo | selfhost
  updatedAt: d.integer(),
}));

// Singleton (id = "default") — cached AI knowledge-graph profile
export const profile = createTable("profile", (d) => ({
  id: d.text().primaryKey(),
  summary: d.text(),
  habitTags: d.text(), // JSON: { name, tags[] }[]
  suggestions: d.text(), // JSON: string[]
  nudgePreference: d.text(),
  entryCount: d.integer().default(0),
  updatedAt: d.integer(),
}));

// Wiki-style knowledge graph — one page per concept/node about the user
export const wikiPages = createTable("wiki_pages", (d) => ({
  slug: d.text().primaryKey(),
  title: d.text().notNull(),
  category: d.text().notNull(), // identity | habits | blockers | goals | thinking | context
  content: d.text().notNull(), // markdown prose
  tags: d.text(), // JSON: string[]
  updatedAt: d.integer().default(sql`(unixepoch())`),
}));

// Directed edges between wiki pages — the graph layer
export const wikiEdges = createTable("wiki_edges", (d) => ({
  id: d.text().primaryKey(),
  fromSlug: d.text().notNull(),
  toSlug: d.text().notNull(),
  relation: d.text().notNull(), // e.g. "blocks", "supports", "is-part-of", "conflicts-with"
}));

// Persistent chat history
export const chatMessages = createTable("chat_messages", (d) => ({
  id: d.text().primaryKey(),
  role: d.text().notNull(), // user | assistant
  content: d.text().notNull(),
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

// Web Push — one row per subscribed device
export const pushSubscriptions = createTable("push_subscriptions", (d) => ({
  id: d.text().primaryKey(),
  endpoint: d.text().notNull(), // unique per device
  p256dh: d.text().notNull(),
  auth: d.text().notNull(),
  userAgent: d.text(),
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

// User-defined habit chains (Atomic Habits stacking)
export const routines = createTable("routines", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  daysOfWeek: d.text(), // JSON: number[] 0=Sun..6=Sat; null = unscheduled
  anchorMinutes: d.integer(), // minutes since local midnight; null = no anchor time
  archived: d.integer().default(0),
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

export const routineSteps = createTable("routine_steps", (d) => ({
  id: d.text().primaryKey(),
  routineId: d.text().notNull(),
  position: d.integer().notNull(),
  name: d.text().notNull(),
  habitId: d.text(), // optional link to an extracted habit — feeds streaks + AI grounding
  minSeconds: d.integer(), // floor — don't rush (brush teeth ≥ 2 min)
  maxSeconds: d.integer(), // ceiling — don't overrun (shower ≤ 15 min)
}));

export const routineRuns = createTable("routine_runs", (d) => ({
  id: d.text().primaryKey(),
  routineId: d.text().notNull(),
  startedAt: d.integer().notNull(),
  endedAt: d.integer(),
  status: d.text().notNull(), // active | completed | abandoned
}));

// One row per step within a run; server timestamps are the timing source of truth
export const stepRuns = createTable("step_runs", (d) => ({
  id: d.text().primaryKey(),
  runId: d.text().notNull(),
  stepId: d.text().notNull(),
  name: d.text().notNull(), // snapshot — the step may be renamed/deleted later
  startedAt: d.integer().notNull(),
  endedAt: d.integer(),
  status: d.text().notNull(), // active | completed | skipped | incomplete | deferred
}));

// Calendar-shaped day timeline — stable ids so phase 2 can mirror rows to
// external calendars (Google, ICS) without reshaping
export const timelineEvents = createTable("timeline_events", (d) => ({
  id: d.text().primaryKey(),
  title: d.text().notNull(),
  kind: d.text().notNull(), // routine_step | checkin
  startAt: d.integer().notNull(),
  endAt: d.integer().notNull(),
  sourceId: d.text(), // step_run id or entry id
  createdAt: d.integer().default(sql`(unixepoch())`),
}));

// Singleton (id = "default") — reminder preferences + last-notified dedupe
export const reminders = createTable("reminders", (d) => ({
  id: d.text().primaryKey(),
  enabled: d.integer().default(0), // 1 when reminders are on
  intervalHours: d.integer().default(3),
  lastNotifiedAt: d.integer(),
  updatedAt: d.integer(),
}));
