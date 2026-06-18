import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().optional(), // used only by drizzle.config.ts for db:push
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Auth
    AUTH_SECRET: z.string().min(1),
    // Central users database (Turso or local file)
    USERS_DATABASE_URL: z.string().min(1),
    USERS_DATABASE_AUTH_TOKEN: z.string().optional(),
    // Turso Platform API — for provisioning per-user databases
    TURSO_API_TOKEN: z.string().optional(),
    TURSO_ORGANIZATION: z.string().optional(),
    // AI providers
    GROQ_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    AI_PROVIDER: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_BASE_URL: z.string().optional(),
    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    FEEDBACK_TO: z.string().optional(),
    AUTH_URL: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    USERS_DATABASE_URL: process.env.USERS_DATABASE_URL,
    USERS_DATABASE_AUTH_TOKEN: process.env.USERS_DATABASE_AUTH_TOKEN,
    TURSO_API_TOKEN: process.env.TURSO_API_TOKEN,
    TURSO_ORGANIZATION: process.env.TURSO_ORGANIZATION,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    AI_BASE_URL: process.env.AI_BASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    FEEDBACK_TO: process.env.FEEDBACK_TO,
    AUTH_URL: process.env.AUTH_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
