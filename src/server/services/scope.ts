import "server-only";
import { sql, type AnyColumn } from "drizzle-orm";

/** Who is acting, and in which organization. Every tenant service takes one. */
export interface Scope {
  userId: string;
  orgId: string;
}

/** Orders fractional-index keys byte-wise, like `<` in JavaScript. See src/lib/positions.ts. */
export function positionOrder(column: AnyColumn) {
  return sql`${column} collate "C"`;
}
