import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env / .env.local the same way Next.js does.
loadEnvConfig(process.cwd());

const LOCAL_DATABASE_URL = "postgresql://stackboard:stackboard@localhost:5433/stackboard";
// An empty DATABASE_URL in .env.local means "use the local Docker database".
const url = process.env.DATABASE_URL?.trim() ? process.env.DATABASE_URL : LOCAL_DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
