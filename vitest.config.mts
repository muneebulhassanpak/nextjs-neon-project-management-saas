import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://stackboard:stackboard@localhost:5433/stackboard_test";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside React Server Components; tests run server code directly.
    alias: { "server-only": new URL("./tests/setup/empty.ts", import.meta.url).pathname },
  },
  test: {
    env: { LOG_LEVEL: "silent" },
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
      // Schema is declarations; utils.ts is shadcn's; auth-client.ts only runs in the browser.
      exclude: ["src/server/db/schema/**", "src/lib/utils.ts", "src/lib/auth-client.ts"],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["./tests/setup/fail-on-console-error.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/setup/test-database.ts"],
          setupFiles: ["./tests/setup/fail-on-console-error.ts", "./tests/setup/request-scope.ts"],
          // Integration tests never touch DATABASE_URL from .env.local.
          env: {
            DATABASE_URL: testDatabaseUrl,
            TEST_DATABASE_URL: testDatabaseUrl,
            // Live updates on, pointed nowhere: tests read the events instead of sending them.
            REALTIME_URL: "http://realtime.test",
            REALTIME_SECRET: "integration-realtime-secret-0000000000",
          },
          fileParallelism: false,
        },
      },
    ],
  },
});
