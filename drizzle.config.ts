import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    // Point db:push at a specific user's DB or a local dev file.
    // Set DATABASE_URL in .env to target the database you want to migrate.
    url: env.DATABASE_URL ?? "file:./db.sqlite",
  },
  tablesFilter: ["introspect_*"],
} satisfies Config;
