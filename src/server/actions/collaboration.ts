"use server";

import { z } from "zod";

import { commentBodySchema } from "@/lib/mentions";
import { requireOrgMember } from "@/server/auth/org";
import type { ActionResult } from "@/server/errors";
import { addComment, deleteComment, editComment } from "@/server/services/comments";
import { markNotificationsRead } from "@/server/services/notifications";

import { runAction } from "./run-action";

/*
 * Comments and notifications. Row-level security decides who can comment on a task (anyone who
 * can see it) and whose comments can be edited or deleted.
 */

const orgId = z.string().min(1);
const id = z.uuid();

async function memberScope(organizationId: string) {
  const actor = await requireOrgMember(organizationId);
  return { userId: actor.user.id, orgId: organizationId };
}

const addSchema = z.object({ orgId, taskId: id, body: commentBodySchema });
export async function addCommentAction(
  input: z.input<typeof addSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { orgId, taskId, body } = addSchema.parse(input);
    return addComment(await memberScope(orgId), taskId, body);
  });
}

const editSchema = z.object({ orgId, commentId: id, body: commentBodySchema });
export async function editCommentAction(
  input: z.input<typeof editSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, commentId, body } = editSchema.parse(input);
    await editComment(await memberScope(orgId), commentId, body);
    return null;
  });
}

const deleteSchema = z.object({ orgId, commentId: id });
export async function deleteCommentAction(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, commentId } = deleteSchema.parse(input);
    await deleteComment(await memberScope(orgId), commentId);
    return null;
  });
}

const readSchema = z.object({ orgId, ids: z.union([z.literal("all"), z.array(id).max(100)]) });
export async function markNotificationsReadAction(
  input: z.input<typeof readSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, ids } = readSchema.parse(input);
    await markNotificationsRead(await memberScope(orgId), ids);
    return null;
  });
}
