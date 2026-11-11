import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { LOCAL_DATABASE_URL } from "@/server/db/url";

// On Vercel every setting that reaches real data must be set explicitly: a missing
// DATABASE_URL must fail the deploy, not silently fall back to a local default.
const onVercel = Boolean(process.env.VERCEL);

/**
 * Every setting is validated at startup, so a bad config fails fast instead of at first use.
 * Settings have safe local defaults; deployed environments must set secrets explicitly.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    // Any Postgres URL: local Docker, a Neon branch, or Neon production.
    DATABASE_URL: onVercel ? z.url() : z.url().default(LOCAL_DATABASE_URL),
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
