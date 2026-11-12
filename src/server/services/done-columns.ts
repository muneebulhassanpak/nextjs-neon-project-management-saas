import "server-only";
import { asc, inArray } from "drizzle-orm";

import { boardColumns } from "@/server/db/schema";
import type { Transaction } from "@/server/db/tenant";

import { positionOrder } from "./scope";

/**
 * Each project's "done" column: its rightmost one. A board with a single column has none, so
 * nothing on it counts as done.
 */
export async function doneColumns(
  tx: Transaction,
  projectIds: string[],
): Promise<Map<string, { id: string; name: string }>> {
  const done = new Map<string, { id: string; name: string }>();
  if (projectIds.length === 0) return done;
  const columns = await tx
    .select({ id: boardColumns.id, name: boardColumns.name, projectId: boardColumns.projectId })
    .from(boardColumns)
    .where(inArray(boardColumns.projectId, projectIds))
    .orderBy(positionOrder(boardColumns.position), asc(boardColumns.id));
  for (const projectId of projectIds) {
    const own = columns.filter((column) => column.projectId === projectId);
    const last = own.at(-1);
    if (own.length > 1 && last) done.set(projectId, { id: last.id, name: last.name });
  }
  return done;
}
