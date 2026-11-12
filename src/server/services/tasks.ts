import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { ActivityEvent } from "@/lib/activity";
import { positionAtEnd } from "@/lib/positions";
import type { TaskDescription, TaskPriority } from "@/lib/projects";
import { boardColumns, labels, taskLabels, tasks, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { publishBoardEvent } from "@/server/realtime";

import { logActivity, loggedRecently } from "./activity";
import { assignablePeople, findColumn, place, tasksIn, type BoardLabel } from "./board";
import { checklistOf, type ChecklistItem } from "./checklists";
import { notify } from "./notifications";
import { positionOrder, type Scope } from "./scope";

import type { Person } from "./projects";

/** Adds a task at the bottom of a column. */
export async function createTask(
  scope: Scope,
  input: { columnId: string; title: string },
): Promise<{ id: string; position: string }> {
  const { task, projectId } = await withOrgContext(scope, async (tx) => {
    const column = await findColumn(tx, input.columnId);
    const position = positionAtEnd(await tasksIn(tx, column.id, { lock: true }));
    const [task] = await tx
      .insert(tasks)
      .values({
        orgId: scope.orgId,
        projectId: column.projectId,
        columnId: column.id,
        title: input.title,
        position,
        createdBy: scope.userId,
      })
      .returning({ id: tasks.id, position: tasks.position });
    if (!task) throw new Error("Task insert returned no row");
    await logActivity(tx, scope, {
      action: "task.created",
      projectId: column.projectId,
      taskId: task.id,
      metadata: { title: input.title, column: column.name },
    });
    return { task, projectId: column.projectId };
  });
  publishBoardEvent(projectId, { type: "task.created", taskId: task.id, actorId: scope.userId });
  return task;
}

export interface TaskDetail {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: TaskDescription;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  createdBy: Person | null;
  createdAt: Date;
  updatedAt: Date;
  labels: BoardLabel[];
  checklist: ChecklistItem[];
}

/** One task with everything the detail sheet shows, or `null` if the user can't see it. */
export async function getTask(scope: Scope, taskId: string): Promise<TaskDetail | null> {
  return withOrgContext(scope, async (tx) => {
    const [row] = await tx
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        columnId: tasks.columnId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        creatorId: user.id,
        creatorName: user.name,
        creatorImage: user.image,
      })
      .from(tasks)
      .leftJoin(user, eq(user.id, tasks.createdBy))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!row) return null;

    const { creatorId, creatorName, creatorImage, ...task } = row;
    return {
      ...task,
      createdBy: creatorId ? { id: creatorId, name: creatorName ?? "", image: creatorImage } : null,
      labels: await tx
        .select({ id: labels.id, name: labels.name, color: labels.color })
        .from(taskLabels)
        .innerJoin(labels, eq(labels.id, taskLabels.labelId))
        .where(eq(taskLabels.taskId, taskId))
        .orderBy(asc(labels.name)),
      checklist: await checklistOf(tx, taskId),
    };
  });
}

export interface TaskChanges {
  title?: string;
  description?: TaskDescription;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

/** Repeated description saves within this window are logged once. */
const DESCRIPTION_LOG_WINDOW_SECONDS = 10 * 60;

/**
 * Updates the given fields and logs each change. An assignee must be someone who can see the
 * project; they're notified unless they assigned themselves.
 */
export async function updateTask(
  scope: Scope,
  taskId: string,
  changes: TaskChanges,
): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, taskId);
    const people = await assignablePeople(tx, scope.orgId, task.projectId);
    return (await applyChanges(tx, scope, task, changes, people)) ? task.projectId : null;
  });
  if (projectId)
    publishBoardEvent(projectId, { type: "task.updated", taskId, actorId: scope.userId });
}

/** Writes `changes` to one task and logs them. Returns false when there was nothing to write. */
async function applyChanges(
  tx: Transaction,
  scope: Scope,
  task: FoundTask,
  changes: TaskChanges,
  people: Person[],
): Promise<boolean> {
  if (changes.assigneeId && !people.some((person) => person.id === changes.assigneeId)) {
    throw new ValidationError("Assign the task to someone on this project.");
  }
  if (Object.keys(changes).length === 0) return false;
  const taskId = task.id;
  const updated = await tx
    .update(tasks)
    .set(changes)
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });
  if (updated.length === 0) throw new ForbiddenError("You can't edit this task.");

  const title = changes.title ?? task.title;
  const log = (event: ActivityEvent) =>
    logActivity(tx, scope, { ...event, projectId: task.projectId, taskId });
  if (changes.title !== undefined && changes.title !== task.title) {
    await log({ action: "task.renamed", metadata: { title, from: task.title } });
  }
  if (changes.priority !== undefined && changes.priority !== task.priority) {
    await log({ action: "task.prioritized", metadata: { title, priority: changes.priority } });
  }
  if (changes.dueDate !== undefined && changes.dueDate !== task.dueDate) {
    await log({ action: "task.scheduled", metadata: { title, dueDate: changes.dueDate } });
  }
  if (
    changes.description !== undefined &&
    !(await loggedRecently(tx, scope, taskId, "task.described", DESCRIPTION_LOG_WINDOW_SECONDS))
  ) {
    await log({ action: "task.described", metadata: { title } });
  }
  if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) {
    const assignee = people.find((person) => person.id === changes.assigneeId);
    await log({ action: "task.assigned", metadata: { title, assignee: assignee?.name ?? null } });
    if (assignee) {
      await notify(tx, scope, { type: "assigned", taskId, recipients: [assignee.id] });
    }
  }
  return true;
}

/**
 * Moves a task into `columnId`, right after `afterTaskId` (or to the top when it's null).
 * Both columns are locked for the move, so concurrent moves are applied one after the other.
 */
export async function moveTask(
  scope: Scope,
  input: { taskId: string; columnId: string; afterTaskId: string | null },
): Promise<{ position: string }> {
  const { position, projectId } = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, input.taskId);
    const column = await findColumn(tx, input.columnId);
    const position = await moveInto(tx, scope, task, column, input.afterTaskId);
    return { position, projectId: task.projectId };
  });
  publishBoardEvent(projectId, { type: "task.moved", taskId: input.taskId, actorId: scope.userId });
  return { position };
}

async function moveInto(
  tx: Transaction,
  scope: Scope,
  task: FoundTask,
  column: { id: string; projectId: string; name: string },
  afterTaskId: string | null,
): Promise<string> {
  if (column.projectId !== task.projectId) {
    throw new ValidationError("Tasks can only move within their project.");
  }
  const siblings = await tasksIn(tx, column.id, { lock: true });
  const position = await place(tx, tasks, siblings, task.id, afterTaskId, {
    columnId: column.id,
  });
  if (column.id !== task.columnId) {
    const from = await findColumn(tx, task.columnId);
    await logActivity(tx, scope, {
      action: "task.moved",
      projectId: task.projectId,
      taskId: task.id,
      metadata: { title: task.title, from: from.name, to: column.name },
    });
  }
  return position;
}

/** Replaces the task's labels with `labelIds`. */
export async function setTaskLabels(
  scope: Scope,
  taskId: string,
  labelIds: string[],
): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, taskId);
    return (await replaceLabels(tx, scope, task, labelIds)) ? task.projectId : null;
  });
  if (projectId)
    publishBoardEvent(projectId, { type: "task.updated", taskId, actorId: scope.userId });
}

/** Returns false when the task already had exactly these labels. */
async function replaceLabels(
  tx: Transaction,
  scope: Scope,
  task: FoundTask,
  labelIds: string[],
): Promise<boolean> {
  const taskId = task.id;
  const wanted = [...new Set(labelIds)];
  const found =
    wanted.length === 0
      ? []
      : await tx
          .select({ id: labels.id, name: labels.name })
          .from(labels)
          .where(and(eq(labels.orgId, scope.orgId), inArray(labels.id, wanted)))
          .orderBy(asc(labels.name));
  if (found.length !== wanted.length) {
    throw new ValidationError("One of the labels no longer exists.");
  }
  const current = await tx
    .select({ id: taskLabels.labelId })
    .from(taskLabels)
    .where(eq(taskLabels.taskId, taskId));
  const unchanged =
    current.length === wanted.length && current.every((label) => wanted.includes(label.id));
  if (unchanged) return false;

  await logActivity(tx, scope, {
    action: "task.labeled",
    projectId: task.projectId,
    taskId,
    metadata: { title: task.title, labels: found.map((label) => label.name) },
  });
  await tx.delete(taskLabels).where(eq(taskLabels.taskId, taskId));
  if (wanted.length > 0) {
    await tx
      .insert(taskLabels)
      .values(wanted.map((labelId) => ({ taskId, labelId, orgId: scope.orgId })));
  }
  return true;
}

/** Deletes a task. Members can delete only the tasks they created (enforced by RLS). */
export async function deleteTask(scope: Scope, taskId: string): Promise<void> {
  const projectId = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, taskId);
    await deleteOne(tx, scope, task);
    return task.projectId;
  });
  publishBoardEvent(projectId, { type: "task.deleted", taskId, actorId: scope.userId });
}

async function deleteOne(tx: Transaction, scope: Scope, task: FoundTask): Promise<void> {
  const deleted = await tx.delete(tasks).where(eq(tasks.id, task.id)).returning({ id: tasks.id });
  if (deleted.length === 0) throw new ForbiddenError("You can only delete tasks you created.");
  await logActivity(tx, scope, {
    action: "task.deleted",
    projectId: task.projectId,
    taskId: task.id,
    metadata: { title: task.title },
  });
}

/** The most tasks one bulk action can change. */
export const BULK_LIMIT = 100;

export type BulkChange =
  | { kind: "move"; columnId: string }
  | { kind: "assign"; assigneeId: string | null }
  | { kind: "priority"; priority: TaskPriority }
  | { kind: "label"; labelId: string }
  | { kind: "delete" };

/**
 * Applies one change to several tasks of the same project, in one transaction: either every
 * task changes or none does (e.g. a member deleting a teammate's task fails the whole action).
 * Moved tasks go to the bottom of the column, keeping their order on the board.
 */
export async function bulkChangeTasks(
  scope: Scope,
  taskIds: string[],
  change: BulkChange,
): Promise<{ changed: number }> {
  const ids = [...new Set(taskIds)];
  if (ids.length === 0) return { changed: 0 };
  if (ids.length > BULK_LIMIT) {
    throw new ValidationError(`Choose at most ${BULK_LIMIT} tasks at a time.`);
  }
  const { projectId, changed } = await withOrgContext(scope, async (tx) => {
    const found = await findTasksInBoardOrder(tx, ids);
    if (found.length !== ids.length)
      throw new NotFoundError("Some of these tasks no longer exist.");
    const projectId = found[0]?.projectId ?? "";
    if (found.some((task) => task.projectId !== projectId)) {
      throw new ValidationError("Choose tasks from one project at a time.");
    }

    let changed = 0;
    switch (change.kind) {
      case "move": {
        const column = await findColumn(tx, change.columnId);
        let afterId =
          (await tasksIn(tx, column.id, { lock: true })).filter((t) => !ids.includes(t.id)).at(-1)
            ?.id ?? null;
        for (const task of found) {
          await moveInto(tx, scope, task, column, afterId);
          afterId = task.id;
          if (task.columnId !== column.id) changed += 1;
        }
        break;
      }
      case "assign":
      case "priority": {
        const people = await assignablePeople(tx, scope.orgId, projectId);
        const changes: TaskChanges =
          change.kind === "assign"
            ? { assigneeId: change.assigneeId }
            : { priority: change.priority };
        for (const task of found) {
          const current = change.kind === "assign" ? task.assigneeId : task.priority;
          const next = change.kind === "assign" ? change.assigneeId : change.priority;
          if (current === next) continue;
          await applyChanges(tx, scope, task, changes, people);
          changed += 1;
        }
        break;
      }
      case "label": {
        const current = await tx
          .select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId })
          .from(taskLabels)
          .where(inArray(taskLabels.taskId, ids));
        for (const task of found) {
          const mine = current.filter((row) => row.taskId === task.id).map((row) => row.labelId);
          if (mine.includes(change.labelId)) continue;
          await replaceLabels(tx, scope, task, [...mine, change.labelId]);
          changed += 1;
        }
        break;
      }
      case "delete":
        for (const task of found) await deleteOne(tx, scope, task);
        changed = found.length;
        break;
    }
    return { projectId, changed };
  });
  if (changed > 0) publishBoardEvent(projectId, { type: "board.changed", actorId: scope.userId });
  return { changed };
}

type FoundTask = Awaited<ReturnType<typeof findTask>>;

/** The tasks, ordered as they appear on the board: by column, then within the column. */
async function findTasksInBoardOrder(tx: Transaction, taskIds: string[]): Promise<FoundTask[]> {
  return tx
    .select(foundTaskFields)
    .from(tasks)
    .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
    .where(inArray(tasks.id, taskIds))
    .orderBy(
      positionOrder(boardColumns.position),
      asc(boardColumns.id),
      positionOrder(tasks.position),
      asc(tasks.id),
    );
}

const foundTaskFields = {
  id: tasks.id,
  projectId: tasks.projectId,
  columnId: tasks.columnId,
  title: tasks.title,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  assigneeId: tasks.assigneeId,
};

async function findTask(tx: Transaction, taskId: string) {
  const [task] = await tx.select(foundTaskFields).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new NotFoundError("This task no longer exists.");
  return task;
}
