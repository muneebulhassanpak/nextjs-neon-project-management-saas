import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Every setting is validated at startup, so a bad config fails fast instead of at first use.
 * Settings have safe local defaults; production must set secrets explicitly.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    // Any Postgres URL: local Docker, a Neon branch, or Neon production.
    DATABASE_URL: z.url().default("postgresql://stackboard:stackboard@localhost:5433/stackboard"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Treat empty strings (e.g. `DATABASE_URL=` in .env.local) as unset, so defaults apply.
  emptyStringAsUndefined: true,
});
