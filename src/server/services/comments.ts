import "server-only";
import { asc, eq } from "drizzle-orm";

import { extractMentions } from "@/lib/mentions";
import { comments, tasks, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { publishBoardEvent } from "@/server/realtime";

import { logActivity } from "./activity";
import { assignablePeople } from "./board";
import { notify } from "./notifications";

import type { Person } from "./projects";
import type { Scope } from "./scope";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: Person | null;
}

/** A task's comments, oldest first. */
export async function listComments(scope: Scope, taskId: string): Promise<CommentItem[]> {
  const rows = await withOrgContext(scope, (tx) =>
    tx
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        authorId: user.id,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comments)
      .leftJoin(user, eq(user.id, comments.authorId))
      .where(eq(comments.taskId, taskId))
      .orderBy(asc(comments.createdAt), asc(comments.id)),
  );
  return rows.map(({ authorId, authorName, authorImage, ...comment }) => ({
    ...comment,
    author: authorId ? { id: authorId, name: authorName ?? "", image: authorImage } : null,
  }));
}

/** Adds a comment, logs it and notifies the people mentioned in it. */
export async function addComment(
  scope: Scope,
  taskId: string,
  body: string,
): Promise<{ id: string }> {
  const { comment, projectId } = await withOrgContext(scope, async (tx) => {
    const task = await findTask(tx, taskId);
    const [comment] = await tx
      .insert(comments)
      .values({ orgId: scope.orgId, taskId, authorId: scope.userId, body })
      .returning({ id: comments.id });
    if (!comment) throw new Error("Comment insert returned no row");

    await logActivity(tx, scope, {
      action: "comment.added",
      projectId: task.projectId,
      taskId,
      metadata: { title: task.title },
    });
    await notifyMentions(tx, scope, task, comment.id, extractMentions(body));
    return { comment, projectId: task.projectId };
  });
  publishBoardEvent(projectId, { type: "comment.changed", taskId, actorId: scope.userId });
  return comment;
}

/** Edits the user's own comment. People newly mentioned in the edit are notified. */
export async function editComment(scope: Scope, commentId: string, body: string): Promise<void> {
  const task = await withOrgContext(scope, async (tx) => {
    const [existing] = await tx
      .select({ taskId: comments.taskId, body: comments.body, authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!existing) throw new NotFoundError("This comment no longer exists.");
    if (existing.authorId !== scope.userId) {
      throw new ForbiddenError("You can only edit your own comments.");
    }

    await tx.update(comments).set({ body, editedAt: new Date() }).where(eq(comments.id, commentId));
    const before = new Set(extractMentions(existing.body));
    const added = extractMentions(body).filter((id) => !before.has(id));
    const task = await findTask(tx, existing.taskId);
    await notifyMentions(tx, scope, task, commentId, added);
    return task;
  });
  publishBoardEvent(task.projectId, {
    type: "comment.changed",
    taskId: task.id,
    actorId: scope.userId,
  });
}

/** Deletes a comment: the author's own, or any comment for owners and admins (RLS decides). */
export async function deleteComment(scope: Scope, commentId: string): Promise<void> {
  const task = await withOrgContext(scope, async (tx) => {
    const [existing] = await tx
      .select({ taskId: comments.taskId })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!existing) throw new NotFoundError("This comment no longer exists.");
    const deleted = await tx
      .delete(comments)
      .where(eq(comments.id, commentId))
      .returning({ id: comments.id });
    if (deleted.length === 0) throw new ForbiddenError("You can only delete your own comments.");
    return findTask(tx, existing.taskId);
  });
  publishBoardEvent(task.projectId, {
    type: "comment.changed",
    taskId: task.id,
    actorId: scope.userId,
  });
}

async function findTask(tx: Transaction, taskId: string) {
  const [task] = await tx
    .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!task) throw new NotFoundError("This task no longer exists.");
  return task;
}

/** Mentions only notify people who can see the project; others are ignored. */
async function notifyMentions(
  tx: Transaction,
  scope: Scope,
  task: { id: string; projectId: string },
  commentId: string,
  mentioned: string[],
): Promise<void> {
  if (mentioned.length === 0) return;
  const people = new Set(
    (await assignablePeople(tx, scope.orgId, task.projectId)).map((person) => person.id),
  );
  await notify(tx, scope, {
    type: "mention",
    taskId: task.id,
    commentId,
    recipients: mentioned.filter((id) => people.has(id)),
  });
}
