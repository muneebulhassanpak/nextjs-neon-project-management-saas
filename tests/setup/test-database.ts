import { execSync } from "node:child_process";

import { Client } from "pg";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://stackboard:stackboard@localhost:5433/stackboard_test";

/**
 * Drops and recreates the test database, then applies every migration.
 * Runs once before the integration tests. Never point TEST_DATABASE_URL at real data.
 */
export default async function setup() {
  const testUrl = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL);
  const name = testUrl.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to reset "${name}": the test database name must end in _test.`);
  }

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.query(`create database "${name}"`);
  await admin.end();

  execSync("pnpm exec drizzle-kit migrate", {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "pipe",
  });
}
