import { createClient } from "@libsql/client/node";

import { env } from "~/env";

const client = createClient({
  url: env.USERS_DATABASE_URL,
  authToken: env.USERS_DATABASE_AUTH_TOKEN,
});

export async function initUsersDb() {
  // Create users table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      dbUrl TEXT NOT NULL,
      dbAuthToken TEXT NOT NULL,
      emailVerified INTEGER,
      createdAt INTEGER DEFAULT (unixepoch())
    )
  `);

  // Create feedback table — central store across all users
  await client.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY NOT NULL,
      message TEXT NOT NULL,
      email TEXT,
      category TEXT,
      userId TEXT,
      userAgent TEXT,
      createdAt INTEGER DEFAULT (unixepoch())
    )
  `);

  // Migrate existing DBs that don't have emailVerified column yet
  try {
    await client.execute("ALTER TABLE users ADD COLUMN emailVerified INTEGER");
  } catch {
    // Column already exists — ignore
  }

  // Create verification tokens table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      token TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    )
  `);
}

export async function getUserByEmail(email: string) {
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE lower(email) = lower(?1)",
    args: [email],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.passwordHash as string,
    dbUrl: row.dbUrl as string,
    dbAuthToken: row.dbAuthToken as string,
    emailVerified: row.emailVerified as number | null,
  };
}

export async function createUser(data: {
  id: string;
  email: string;
  passwordHash: string;
  dbUrl: string;
  dbAuthToken: string;
}) {
  await initUsersDb();
  await client.execute({
    sql: "INSERT INTO users (id, email, passwordHash, dbUrl, dbAuthToken) VALUES (?1, ?2, ?3, ?4, ?5)",
    args: [
      data.id,
      data.email.toLowerCase(),
      data.passwordHash,
      data.dbUrl,
      data.dbAuthToken,
    ],
  });
}

export async function createVerificationToken(email: string): Promise<string> {
  await initUsersDb();
  // Remove any prior tokens for this email
  await client.execute({
    sql: "DELETE FROM verification_tokens WHERE lower(email) = lower(?1)",
    args: [email],
  });
  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
  await client.execute({
    sql: "INSERT INTO verification_tokens (token, email, expiresAt) VALUES (?1, ?2, ?3)",
    args: [token, email.toLowerCase(), expiresAt],
  });
  return token;
}

export async function consumeVerificationToken(
  token: string,
): Promise<{ email: string } | null> {
  const result = await client.execute({
    sql: "SELECT * FROM verification_tokens WHERE token = ?1",
    args: [token],
  });
  const row = result.rows[0];
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if ((row.expiresAt as number) < now) {
    // Expired — clean up
    await client.execute({
      sql: "DELETE FROM verification_tokens WHERE token = ?1",
      args: [token],
    });
    return null;
  }
  // Consume (single-use)
  await client.execute({
    sql: "DELETE FROM verification_tokens WHERE token = ?1",
    args: [token],
  });
  return { email: row.email as string };
}

export async function markEmailVerified(email: string): Promise<void> {
  await client.execute({
    sql: "UPDATE users SET emailVerified = unixepoch() WHERE lower(email) = lower(?1)",
    args: [email],
  });
}

export async function createFeedback(data: {
  message: string;
  email?: string;
  category?: string;
  userId?: string;
  userAgent?: string;
}): Promise<void> {
  await initUsersDb();
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO feedback (id, message, email, category, userId, userAgent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    args: [
      id,
      data.message,
      data.email ?? null,
      data.category ?? null,
      data.userId ?? null,
      data.userAgent ?? null,
    ],
  });
}

export async function listFeedback(): Promise<
  {
    id: string;
    message: string;
    email: string | null;
    category: string | null;
    userId: string | null;
    userAgent: string | null;
    createdAt: number;
  }[]
> {
  const result = await client.execute(
    "SELECT * FROM feedback ORDER BY createdAt DESC",
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    message: row.message as string,
    email: row.email as string | null,
    category: row.category as string | null,
    userId: row.userId as string | null,
    userAgent: row.userAgent as string | null,
    createdAt: row.createdAt as number,
  }));
}
