import "server-only";
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";

import { placeAfter, positionAtEnd, rebalance, type Positioned } from "@/lib/positions";
import type { TaskPriority } from "@/lib/projects";
import {
  boardColumns,
  checklistItems,
  labels,
  member,
  projectMembers,
  taskLabels,
  tasks,
  user,
} from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";
import { NotFoundError, ValidationError } from "@/server/errors";
import { publishBoardEvent } from "@/server/realtime";

import { positionOrder, type Scope } from "./scope";

import type { Person } from "./projects";

export interface BoardColumn {
  id: string;
  name: string;
  position: string;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

export interface BoardTask {
  id: string;
  columnId: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  position: string;
  assignee: Person | null;
  labels: BoardLabel[];
  hasDescription: boolean;
  createdBy: string | null;
  /** Ticked and total checklist items, or null without a checklist. */
  checklist: { done: number; total: number } | null;
}

export interface Board {
  columns: BoardColumn[];
  tasks: BoardTask[];
  /** People tasks can be assigned to: owners, admins and the project's members. */
  people: Person[];
  /** The organization's labels. */
  labels: BoardLabel[];
}

/** Everything the board and list views need, in one transaction. */
export async function getBoard(scope: Scope, projectId: string): Promise<Board> {
  return withOrgContext(scope, async (tx) => {
    const columns = await tx
      .select({ id: boardColumns.id, name: boardColumns.name, position: boardColumns.position })
      .from(boardColumns)
      .where(eq(boardColumns.projectId, projectId))
      .orderBy(positionOrder(boardColumns.position), asc(boardColumns.id));
    // RLS hides the columns of projects the user can't see; no columns means no project.
    if (columns.length === 0) throw new NotFoundError("This project doesn't exist.");

    const rows = await tx
      .select({
        id: tasks.id,
        columnId: tasks.columnId,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        position: tasks.position,
        description: tasks.description,
        createdBy: tasks.createdBy,
        assigneeId: user.id,
        assigneeName: user.name,
        assigneeImage: user.image,
      })
      .from(tasks)
      .leftJoin(user, eq(user.id, tasks.assigneeId))
      .where(eq(tasks.projectId, projectId))
      .orderBy(positionOrder(tasks.position), asc(tasks.id));

    const labelRows =
      rows.length === 0
        ? []
        : await tx
            .select({
              taskId: taskLabels.taskId,
              id: labels.id,
              name: labels.name,
              color: labels.color,
            })
            .from(taskLabels)
            .innerJoin(labels, eq(labels.id, taskLabels.labelId))
            .where(
              inArray(
                taskLabels.taskId,
                rows.map((r) => r.id),
              ),
            )
            .orderBy(asc(labels.name));
    const checklistRows =
      rows.length === 0
        ? []
        : await tx
            .select({
              taskId: checklistItems.taskId,
              total: count(),
              done: count(sql`case when ${checklistItems.done} then 1 end`),
            })
            .from(checklistItems)
            .where(
              inArray(
                checklistItems.taskId,
                rows.map((r) => r.id),
              ),
            )
            .groupBy(checklistItems.taskId);
    const checklistByTask = new Map(
      checklistRows.map(({ taskId, done, total }) => [taskId, { done, total }]),
    );

    const labelsByTask = new Map<string, BoardLabel[]>();
    for (const { taskId, ...label } of labelRows) {
      labelsByTask.set(taskId, [...(labelsByTask.get(taskId) ?? []), label]);
    }

    return {
      columns,
      tasks: rows.map((row) => ({
        id: row.id,
        columnId: row.columnId,
        title: row.title,
        priority: row.priority,
        dueDate: row.dueDate,
        position: row.position,
        createdBy: row.createdBy,
        hasDescription: hasText(row.description),
        assignee: row.assigneeId
          ? { id: row.assigneeId, name: row.assigneeName ?? "", image: row.assigneeImage }
          : null,
        labels: labelsByTask.get(row.id) ?? [],
        checklist: checklistByTask.get(row.id) ?? null,
      })),
      people: await assignablePeople(tx, scope.orgId, projectId),
      labels: await tx
        .select({ id: labels.id, name: labels.name, color: labels.color })
        .from(labels)
        .where(eq(labels.orgId, scope.orgId))
        .orderBy(asc(labels.name)),
    };
  });
}

function hasText(doc: unknown): boolean {
  const content = (doc as { content?: unknown[] } | null)?.content;
  return Array.isArray(content) && JSON.stringify(content).includes('"text"');
}

/** Owners and admins of the organization, plus the members assigned to the project. */
export async function assignablePeople(
  tx: Transaction,
  orgId: string,
  projectId: string,
): Promise<Person[]> {
  return tx
    .selectDistinct({ id: user.id, name: user.name, image: user.image })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      projectMembers,
      and(eq(projectMembers.userId, member.userId), eq(projectMembers.projectId, projectId)),
    )
    .where(
      and(
        eq(member.organizationId, orgId),
        or(inArray(member.role, ["owner", "admin"]), eq(projectMembers.projectId, projectId)),
      ),
    )
    .orderBy(asc(user.name));
}

/** Adds a column at the right end of the board. */
export async function createColumn(
  scope: Scope,
  projectId: string,
  name: string,
): Promise<BoardColumn> {
  const column = await withOrgContext(scope, async (tx) => {
    const existing = await columnsOf(tx, projectId);
    if (existing.length === 0) throw new NotFoundError("This project doesn't exist.");
    const [column] = await tx
      .insert(boardColumns)
      .values({ orgId: scope.orgId, projectId, name, position: positionAtEnd(existing) })
      .returning({ id: boardColumns.id, name: boardColumns.name, position: boardColumns.position });
    if (!column) throw new Error("Column insert returned no row");
    return column;
  });
  publishBoardEvent(projectId, { type: "column.changed", actorId: scope.userId });
  return column;
}

export async function renameColumn(scope: Scope, columnId: string, name: string): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const [updated] = await tx
      .update(boardColumns)
      .set({ name })
      .where(eq(boardColumns.id, columnId))
      .returning({ projectId: boardColumns.projectId });
    if (!updated) throw new NotFoundError("This column no longer exists.");
    return updated.projectId;
  });
  publishBoardEvent(projectId, { type: "column.changed", actorId: scope.userId });
}

/** Moves a column one place to the left or right. */
export async function moveColumn(
  scope: Scope,
  columnId: string,
  direction: "left" | "right",
): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const column = await findColumn(tx, columnId);
    const columns = await columnsOf(tx, column.projectId, { lock: true });
    const index = columns.findIndex((c) => c.id === columnId);
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= columns.length) return null;

    // Moving right puts it after its right neighbour; moving left, after the one two to the left.
    const afterId =
      direction === "right" ? (columns[target]?.id ?? null) : (columns[target - 1]?.id ?? null);
    await place(tx, boardColumns, columns, columnId, afterId);
    return column.projectId;
  });
  if (projectId) publishBoardEvent(projectId, { type: "column.changed", actorId: scope.userId });
}

/**
 * Deletes a column. Its tasks move to the end of `moveTasksTo`; a column that still has tasks
 * can't be deleted without one. The last column can't be deleted.
 */
export async function deleteColumn(
  scope: Scope,
  columnId: string,
  moveTasksTo: string | null,
): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const column = await findColumn(tx, columnId);
    const columns = await columnsOf(tx, column.projectId, { lock: true });
    if (columns.length <= 1) throw new ValidationError("A board needs at least one column.");

    const orphans = await tasksIn(tx, columnId, { lock: true });
    if (orphans.length > 0) {
      if (!moveTasksTo || moveTasksTo === columnId || !columns.some((c) => c.id === moveTasksTo)) {
        throw new ValidationError("Choose where this column's tasks should go.");
      }
      let previous = (await tasksIn(tx, moveTasksTo, { lock: true })).at(-1)?.position ?? null;
      for (const task of orphans) {
        const position = positionAtEnd(previous === null ? [] : [{ id: "", position: previous }]);
        await tx
          .update(tasks)
          .set({ columnId: moveTasksTo, position })
          .where(eq(tasks.id, task.id));
        previous = position;
      }
    }
    await tx.delete(boardColumns).where(eq(boardColumns.id, columnId));
    return column.projectId;
  });
  publishBoardEvent(projectId, { type: "column.changed", actorId: scope.userId });
}

export async function findColumn(tx: Transaction, columnId: string) {
  const [column] = await tx
    .select({ id: boardColumns.id, projectId: boardColumns.projectId, name: boardColumns.name })
    .from(boardColumns)
    .where(eq(boardColumns.id, columnId))
    .limit(1);
  if (!column) throw new NotFoundError("This column no longer exists.");
  return column;
}

async function columnsOf(
  tx: Transaction,
  projectId: string,
  { lock = false }: { lock?: boolean } = {},
): Promise<Positioned[]> {
  const query = tx
    .select({ id: boardColumns.id, position: boardColumns.position })
    .from(boardColumns)
    .where(eq(boardColumns.projectId, projectId))
    .orderBy(positionOrder(boardColumns.position), asc(boardColumns.id));
  return lock ? query.for("update") : query;
}

/** The tasks in a column, in order. With `lock`, other moves into it wait for this one. */
export async function tasksIn(
  tx: Transaction,
  columnId: string,
  { lock = false }: { lock?: boolean } = {},
): Promise<Positioned[]> {
  const query = tx
    .select({ id: tasks.id, position: tasks.position })
    .from(tasks)
    .where(eq(tasks.columnId, columnId))
    .orderBy(positionOrder(tasks.position), asc(tasks.id));
  return lock ? query.for("update") : query;
}

/**
 * Gives `movedId` a position right after `afterId` among `siblings`, renumbering the siblings
 * first if two moves raced into the same gap. Returns the new position.
 */
export async function place(
  tx: Transaction,
  table: typeof tasks | typeof boardColumns,
  siblings: Positioned[],
  movedId: string,
  afterId: string | null,
  extra: Partial<{ columnId: string }> = {},
): Promise<string> {
  let placement = placeAfter(siblings, movedId, afterId);
  if (placement.kind === "rebalance") {
    const renumbered = rebalance(siblings.filter((s) => s.id !== movedId));
    for (const sibling of renumbered) {
      await tx.update(table).set({ position: sibling.position }).where(eq(table.id, sibling.id));
    }
    placement = placeAfter(renumbered, movedId, afterId);
    if (placement.kind === "rebalance")
      throw new Error("Positions still collide after rebalancing");
  }
  await tx
    .update(table)
    .set({ position: placement.position, ...extra })
    .where(eq(table.id, movedId));
  return placement.position;
}
