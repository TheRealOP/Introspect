import { env } from "~/env";

interface TursoDbResult {
  dbUrl: string;
  dbAuthToken: string;
}

export async function provisionUserDb(userId: string): Promise<TursoDbResult> {
  // Dev fallback: if no Turso Platform API token, use a local SQLite file
  if (!env.TURSO_API_TOKEN || !env.TURSO_ORGANIZATION) {
    return {
      dbUrl: `file:./user-${userId}.sqlite`,
      dbAuthToken: "",
    };
  }

  const org = env.TURSO_ORGANIZATION;
  const token = env.TURSO_API_TOKEN;
  const dbName = `introspect-${userId.replace(/-/g, "").slice(0, 20)}`;

  // Create the database
  const createRes = await fetch(
    `https://api.turso.tech/v1/organizations/${org}/databases`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: dbName, group: "default" }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Turso database: ${err}`);
  }

  const createData = (await createRes.json()) as {
    database: { Hostname: string; Name: string };
  };
  const hostname = createData.database.Hostname;

  // Create an auth token for this database
  const tokenRes = await fetch(
    `https://api.turso.tech/v1/organizations/${org}/databases/${dbName}/auth/tokens?expiration=never`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to create Turso auth token: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as { jwt: string };

  return {
    dbUrl: `libsql://${hostname}`,
    dbAuthToken: tokenData.jwt,
  };
}
