import "server-only";
import { asc, eq } from "drizzle-orm";

import { positionAtEnd } from "@/lib/positions";
import { checklistItems, tasks } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { publishBoardEvent } from "@/server/realtime";

import { positionOrder, type Scope } from "./scope";

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

/** The most items one checklist can hold. */
export const CHECKLIST_LIMIT = 50;

/** A task's checklist, in order. */
export async function checklistOf(tx: Transaction, taskId: string): Promise<ChecklistItem[]> {
  return tx
    .select({ id: checklistItems.id, title: checklistItems.title, done: checklistItems.done })
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(positionOrder(checklistItems.position), asc(checklistItems.id));
}

/** Adds an item at the end of the task's checklist. */
export async function addChecklistItem(
  scope: Scope,
  taskId: string,
  title: string,
): Promise<ChecklistItem> {
  const { item, projectId } = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, taskId);
    const existing = await tx
      .select({ id: checklistItems.id, position: checklistItems.position })
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(positionOrder(checklistItems.position), asc(checklistItems.id))
      .for("update");
    if (existing.length >= CHECKLIST_LIMIT) {
      throw new ValidationError(`A checklist can hold up to ${CHECKLIST_LIMIT} items.`);
    }
    const [item] = await tx
      .insert(checklistItems)
      .values({
        orgId: scope.orgId,
        taskId,
        title,
        position: positionAtEnd(existing),
        createdBy: scope.userId,
      })
      .returning({ id: checklistItems.id, title: checklistItems.title, done: checklistItems.done });
    if (!item) throw new Error("Checklist insert returned no row");
    return { item, projectId: task.projectId };
  });
  publishBoardEvent(projectId, { type: "task.updated", taskId, actorId: scope.userId });
  return item;
}

/** Renames an item or ticks it off. */
export async function updateChecklistItem(
  scope: Scope,
  itemId: string,
  changes: { title?: string; done?: boolean },
): Promise<void> {
  const task = await withOrgContext(scope, async (tx) => {
    const item = await findItem(tx, itemId);
    if (Object.keys(changes).length > 0) {
      const updated = await tx
        .update(checklistItems)
        .set(changes)
        .where(eq(checklistItems.id, itemId))
        .returning({ id: checklistItems.id });
      if (updated.length === 0) throw new ForbiddenError("You can't edit this checklist.");
    }
    return item;
  });
  publishBoardEvent(task.projectId, {
    type: "task.updated",
    taskId: task.taskId,
    actorId: scope.userId,
  });
}

export async function deleteChecklistItem(scope: Scope, itemId: string): Promise<void> {
  const task = await withOrgContext(scope, async (tx) => {
    const item = await findItem(tx, itemId);
    const deleted = await tx
      .delete(checklistItems)
      .where(eq(checklistItems.id, itemId))
      .returning({ id: checklistItems.id });
    if (deleted.length === 0) throw new ForbiddenError("You can't edit this checklist.");
    return item;
  });
  publishBoardEvent(task.projectId, {
    type: "task.updated",
    taskId: task.taskId,
    actorId: scope.userId,
  });
}

async function findTask(tx: Transaction, taskId: string) {
  const [task] = await tx
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!task) throw new NotFoundError("This task no longer exists.");
  return task;
}

/** The item's task and project. RLS hides items of tasks the user can't see. */
async function findItem(tx: Transaction, itemId: string) {
  const [item] = await tx
    .select({ taskId: checklistItems.taskId, projectId: tasks.projectId })
    .from(checklistItems)
    .innerJoin(tasks, eq(tasks.id, checklistItems.taskId))
    .where(eq(checklistItems.id, itemId))
    .limit(1);
  if (!item) throw new NotFoundError("This checklist item no longer exists.");
  return item;
}
