import { sql } from "drizzle-orm";
import { sqliteTableCreator } from "drizzle-orm/sqlite-core";

export const createTable = sqliteTableCreator((name) => `introspect_${name}`);

export const entries = createTable("entries", (d) => ({
  id: d.text().primaryKey(),
  content: d.text().notNull(),
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
  createdAt: d.integer().default(sql`(unixepoch())`),
}));
