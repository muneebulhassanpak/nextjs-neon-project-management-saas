import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/env";

import * as schema from "./schema";

// node-postgres works the same against local Docker, CI and Neon (use Neon's pooled URL).
// In development the pool is kept on globalThis so hot reloads don't open new connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({ connectionString: env.DATABASE_URL, max: 10, idleTimeoutMillis: 5_000 });

if (env.NODE_ENV !== "production") globalForDb.pool = pool;

// On Vercel, closes idle connections before a function instance is suspended.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type Database = typeof db;
