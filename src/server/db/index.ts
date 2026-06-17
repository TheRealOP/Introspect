import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// Cache DB connections by URL to avoid reconnecting on every request
const dbCache = new Map<string, ReturnType<typeof drizzle>>();

export function createUserDb(url: string, authToken?: string) {
  const cached = dbCache.get(url);
  if (cached) return cached;
  const client = createClient({ url, authToken: authToken ?? undefined });
  const db = drizzle(client, { schema });
  dbCache.set(url, db);
  return db;
}

export type UserDb = ReturnType<typeof createUserDb>;
