import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const REALTIME_PORT = 8787;
const REALTIME_SECRET = "local-development-realtime-secret-0000";

// Always the local test database, never DATABASE_URL from .env.local (which may be Neon).
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://stackboard:stackboard@localhost:5433/stackboard";

/** End-to-end tests run against a production build (`pnpm build` first). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `pnpm start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        BETTER_AUTH_URL: `http://localhost:${PORT}`,
        EMAIL_MODE: "console",
        AUTH_RATE_LIMIT: "false",
        LOG_LEVEL: "warn",
        REALTIME_URL: `http://localhost:${REALTIME_PORT}`,
        REALTIME_SECRET,
      },
    },
    {
      // The realtime Worker, run locally by wrangler (no Cloudflare account needed).
      command: `pnpm exec wrangler dev -c realtime/wrangler.jsonc --port ${REALTIME_PORT} --var REALTIME_SECRET:${REALTIME_SECRET}`,
      url: `http://localhost:${REALTIME_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { WRANGLER_SEND_METRICS: "false" },
    },
  ],
});
