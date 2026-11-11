import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { resolveDatabaseUrl } from "./src/server/db/url";

// Load .env / .env.local the same way Next.js does.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations use Neon's direct (unpooled) connection when available. An empty
    // DATABASE_URL in .env.local means the local Docker database.
    url: resolveDatabaseUrl(process.env.DATABASE_URL_UNPOOLED, process.env.DATABASE_URL),
  },
  strict: true,
  verbose: true,
});
