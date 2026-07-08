import "server-only";
import { getToken } from "next-auth/jwt";

import { env } from "~/env";

export type UserDbCredentials = { dbUrl: string; dbAuthToken: string };

/**
 * Read the per-user Turso credentials from the encrypted NextAuth JWT.
 *
 * These live in the JWT only — never in the session object returned by
 * `auth()` / `/api/auth/session` — so they are never exposed to the browser
 * (see H1 in the 2026-07-07 audit). Server code that needs to open the user's
 * database must go through this helper instead of `session.user.dbUrl`.
 *
 * Pass the incoming request headers (a `Headers` object); `getToken` reads the
 * session cookie off them and decrypts the token with `AUTH_SECRET`. The cookie
 * name and salt default to NextAuth v5's `authjs.session-token`, matching what
 * the session handler writes.
 */
export async function getUserDbCredentials(
  headers: Headers,
): Promise<UserDbCredentials | null> {
  const token = await getToken({
    // getToken only needs the request headers to find the session cookie.
    req: { headers } as unknown as Parameters<typeof getToken>[0]["req"],
    secret: env.AUTH_SECRET,
    secureCookie: env.NODE_ENV === "production",
  });

  if (!token?.dbUrl) return null;

  // dbAuthToken is an empty string for local file DBs in dev — that's valid.
  return { dbUrl: token.dbUrl, dbAuthToken: token.dbAuthToken ?? "" };
}
