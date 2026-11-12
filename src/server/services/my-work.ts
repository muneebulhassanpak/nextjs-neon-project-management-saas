import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";

import type { MyWorkTask } from "@/lib/my-work";
import { boardColumns, checklistItems, projects, tasks } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";

import { positionOrder, type Scope } from "./scope";

/**
 * Every task assigned to the user in the organization's active projects that they can see
 * (RLS hides the rest). A task in its board's rightmost column counts as done (unless the
 * board has only one column).
 */
export async function listMyWork(scope: Scope): Promise<MyWorkTask[]> {
  return withOrgContext(scope, async (tx) => {
    const rows = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
        projectName: projects.name,
        columnId: tasks.columnId,
        columnName: boardColumns.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
      .where(and(eq(tasks.assigneeId, scope.userId), isNull(projects.archivedAt)))
      .orderBy(asc(tasks.dueDate), asc(tasks.title));
    if (rows.length === 0) return [];

    const projectIds = [...new Set(rows.map((row) => row.projectId))];
    const columns = await tx
      .select({ id: boardColumns.id, projectId: boardColumns.projectId })
      .from(boardColumns)
      .where(inArray(boardColumns.projectId, projectIds))
      .orderBy(positionOrder(boardColumns.position), asc(boardColumns.id));
    // A board with a single column has no "done" column.
    const lastColumn = new Map<string, string>();
    for (const projectId of projectIds) {
      const own = columns.filter((column) => column.projectId === projectId);
      const last = own.at(-1);
      if (own.length > 1 && last) lastColumn.set(projectId, last.id);
    }

    const checklists = await tx
      .select({
        taskId: checklistItems.taskId,
        total: count(),
        done: count(sql`case when ${checklistItems.done} then 1 end`),
      })
      .from(checklistItems)
      .where(
        inArray(
          checklistItems.taskId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(checklistItems.taskId);
    const checklistByTask = new Map(checklists.map(({ taskId, ...rest }) => [taskId, rest]));

    return rows.map(({ columnId, ...row }) => ({
      ...row,
      done: lastColumn.get(row.projectId) === columnId,
      checklist: checklistByTask.get(row.id) ?? null,
    }));
  });
}
