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

    // Auth. Generate the secret with: openssl rand -base64 32
    BETTER_AUTH_SECRET: onVercel
      ? z.string().min(32)
      : z.string().min(32).default("local-development-secret-do-not-use-in-production"),
    // Public URL of the app. On Vercel it's worked out from the deployment URL when unset.
    BETTER_AUTH_URL: z.url().optional(),
    // Optional social sign-in. A provider's button only shows when both values are set.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // Sign-in rate limiting (production only). Turned off for end-to-end tests.
    AUTH_RATE_LIMIT: z.stringbool().default(true),

    // Email. "console" prints emails to the server log, so everything works without an account.
    EMAIL_MODE: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Stackboard <onboarding@resend.dev>"),

    // Live boards (Cloudflare Worker in realtime/). Both unset means boards update on refetch only.
    REALTIME_URL: z.url().optional(),
    REALTIME_SECRET: z.string().min(32).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    AUTH_RATE_LIMIT: process.env.AUTH_RATE_LIMIT,
    EMAIL_MODE: process.env.EMAIL_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REALTIME_URL: process.env.REALTIME_URL,
    REALTIME_SECRET: process.env.REALTIME_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Treat empty strings (e.g. `DATABASE_URL=` in .env.local) as unset, so defaults apply.
  emptyStringAsUndefined: true,
});
