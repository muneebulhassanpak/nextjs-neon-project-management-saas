import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/server/db/client";
import { logger } from "@/server/logger";

/** Liveness and database check, used by uptime monitors and the CI smoke test. */
export async function GET() {
  await connection();

  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    logger.error({ err: error }, "health check: database unreachable");
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
