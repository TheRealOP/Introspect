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
