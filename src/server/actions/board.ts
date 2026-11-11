"use server";

import { z } from "zod";

import {
  columnNameSchema,
  dueDateSchema,
  labelNameSchema,
  TASK_PRIORITIES,
  taskDescriptionSchema,
  taskTitleSchema,
} from "@/lib/projects";
import { requireOrgMember } from "@/server/auth/org";
import { ForbiddenError } from "@/server/errors";
import type { ActionResult } from "@/server/errors";
import type { BoardColumn, BoardLabel } from "@/server/services/board";
import { createColumn, deleteColumn, moveColumn, renameColumn } from "@/server/services/board";
import { createLabel } from "@/server/services/labels";
import {
  createTask,
  deleteTask,
  moveTask,
  setTaskLabels,
  updateTask,
} from "@/server/services/tasks";

import { runAction } from "./run-action";

/*
 * Board actions for the people who work on a project. Postgres row-level security decides
 * whether the user may change this project (owners, admins and assigned members); these
 * actions only turn clients away early with a clearer message.
 */

const orgId = z.string().min(1);
const id = z.uuid();

async function editorScope(organizationId: string) {
  const actor = await requireOrgMember(organizationId);
  if (actor.role === "client") throw new ForbiddenError("Clients can't change projects.");
  return { userId: actor.user.id, orgId: organizationId };
}

function action<S extends z.ZodType, T>(schema: S, fn: (input: z.output<S>) => Promise<T>) {
  return async (input: z.input<S>): Promise<ActionResult<T>> =>
    runAction(async () => fn(schema.parse(input)));
}

// Tasks

const createTaskSchema = z.object({ orgId, columnId: id, title: taskTitleSchema });
export async function createTaskAction(input: z.input<typeof createTaskSchema>) {
  return action(createTaskSchema, async ({ orgId, ...task }) =>
    createTask(await editorScope(orgId), task),
  )(input);
}

const updateTaskSchema = z.object({
  orgId,
  taskId: id,
  changes: z
    .object({
      title: taskTitleSchema,
      description: taskDescriptionSchema,
      priority: z.enum(TASK_PRIORITIES),
      dueDate: dueDateSchema,
      assigneeId: z.string().min(1).nullable(),
    })
    .partial()
    .strict(),
});
export async function updateTaskAction(
  input: z.input<typeof updateTaskSchema>,
): Promise<ActionResult<null>> {
  return action(updateTaskSchema, async ({ orgId, taskId, changes }) => {
    await updateTask(await editorScope(orgId), taskId, changes);
    return null;
  })(input);
}

const moveTaskSchema = z.object({ orgId, taskId: id, columnId: id, afterTaskId: id.nullable() });
export async function moveTaskAction(input: z.input<typeof moveTaskSchema>) {
  return action(moveTaskSchema, async ({ orgId, ...move }) =>
    moveTask(await editorScope(orgId), move),
  )(input);
}

const taskLabelsSchema = z.object({ orgId, taskId: id, labelIds: z.array(id).max(20) });
export async function setTaskLabelsAction(
  input: z.input<typeof taskLabelsSchema>,
): Promise<ActionResult<null>> {
  return action(taskLabelsSchema, async ({ orgId, taskId, labelIds }) => {
    await setTaskLabels(await editorScope(orgId), taskId, labelIds);
    return null;
  })(input);
}

const deleteTaskSchema = z.object({ orgId, taskId: id });
export async function deleteTaskAction(
  input: z.input<typeof deleteTaskSchema>,
): Promise<ActionResult<null>> {
  return action(deleteTaskSchema, async ({ orgId, taskId }) => {
    await deleteTask(await editorScope(orgId), taskId);
    return null;
  })(input);
}

// Columns

const createColumnSchema = z.object({ orgId, projectId: id, name: columnNameSchema });
export async function createColumnAction(
  input: z.input<typeof createColumnSchema>,
): Promise<ActionResult<BoardColumn>> {
  return action(createColumnSchema, async ({ orgId, projectId, name }) =>
    createColumn(await editorScope(orgId), projectId, name),
  )(input);
}

const renameColumnSchema = z.object({ orgId, columnId: id, name: columnNameSchema });
export async function renameColumnAction(
  input: z.input<typeof renameColumnSchema>,
): Promise<ActionResult<null>> {
  return action(renameColumnSchema, async ({ orgId, columnId, name }) => {
    await renameColumn(await editorScope(orgId), columnId, name);
    return null;
  })(input);
}

const moveColumnSchema = z.object({ orgId, columnId: id, direction: z.enum(["left", "right"]) });
export async function moveColumnAction(
  input: z.input<typeof moveColumnSchema>,
): Promise<ActionResult<null>> {
  return action(moveColumnSchema, async ({ orgId, columnId, direction }) => {
    await moveColumn(await editorScope(orgId), columnId, direction);
    return null;
  })(input);
}

const deleteColumnSchema = z.object({ orgId, columnId: id, moveTasksTo: id.nullable() });
export async function deleteColumnAction(
  input: z.input<typeof deleteColumnSchema>,
): Promise<ActionResult<null>> {
  return action(deleteColumnSchema, async ({ orgId, columnId, moveTasksTo }) => {
    await deleteColumn(await editorScope(orgId), columnId, moveTasksTo);
    return null;
  })(input);
}

// Labels

const createLabelSchema = z.object({ orgId, name: labelNameSchema });
export async function createLabelAction(
  input: z.input<typeof createLabelSchema>,
): Promise<ActionResult<BoardLabel>> {
  return action(createLabelSchema, async ({ orgId, name }) =>
    createLabel(await editorScope(orgId), { name }),
  )(input);
}
