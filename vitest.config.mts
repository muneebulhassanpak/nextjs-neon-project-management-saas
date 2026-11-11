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
    setupFiles: ["./tests/setup/fail-on-console-error.ts"],
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts"],
      exclude: ["src/server/db/schema/**"],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/setup/test-database.ts"],
          // Integration tests never touch DATABASE_URL from .env.local.
          env: { DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl },
          fileParallelism: false,
        },
      },
    ],
  },
});
