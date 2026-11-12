import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";

import { extractMentions } from "@/lib/mentions";
import { REACTIONS, type Reaction, type ReactionSummary } from "@/lib/reactions";
import { commentReactions, comments, tasks, user } from "@/server/db/schema";
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
  reactions: ReactionSummary[];
}

/** A task's comments, oldest first, with their reactions. */
export async function listComments(scope: Scope, taskId: string): Promise<CommentItem[]> {
  const { rows, reactionRows } = await withOrgContext(scope, async (tx) => {
    const rows = await tx
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
      .orderBy(asc(comments.createdAt), asc(comments.id));
    const reactionRows =
      rows.length === 0
        ? []
        : await tx
            .select({
              commentId: commentReactions.commentId,
              emoji: commentReactions.emoji,
              userId: commentReactions.userId,
              name: user.name,
            })
            .from(commentReactions)
            .innerJoin(user, eq(user.id, commentReactions.userId))
            .where(
              inArray(
                commentReactions.commentId,
                rows.map((row) => row.id),
              ),
            )
            .orderBy(asc(commentReactions.createdAt));
    return { rows, reactionRows };
  });

  const reactionsByComment = new Map<string, ReactionSummary[]>();
  for (const row of reactionRows) {
    const list = reactionsByComment.get(row.commentId) ?? [];
    let summary = list.find((r) => r.emoji === row.emoji);
    if (!summary) {
      summary = { emoji: row.emoji, count: 0, mine: false, people: [] };
      list.push(summary);
    }
    summary.count += 1;
    summary.people.push(row.name);
    if (row.userId === scope.userId) summary.mine = true;
    reactionsByComment.set(row.commentId, list);
  }
  return rows.map(({ authorId, authorName, authorImage, ...comment }) => ({
    ...comment,
    author: authorId ? { id: authorId, name: authorName ?? "", image: authorImage } : null,
    reactions: (reactionsByComment.get(comment.id) ?? []).sort(
      (a, b) => REACTIONS.indexOf(a.emoji) - REACTIONS.indexOf(b.emoji),
    ),
  }));
}

/** Adds the user's reaction to a comment, or takes it back if they'd already left it. */
export async function toggleReaction(
  scope: Scope,
  commentId: string,
  emoji: Reaction,
): Promise<{ reacted: boolean }> {
  const { task, reacted } = await withOrgContext(scope, async (tx) => {
    const [comment] = await tx
      .select({ taskId: comments.taskId })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundError("This comment no longer exists.");
    const task = await findTask(tx, comment.taskId);
    const removed = await tx
      .delete(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, scope.userId),
          eq(commentReactions.emoji, emoji),
        ),
      )
      .returning({ emoji: commentReactions.emoji });
    if (removed.length > 0) return { task, reacted: false };
    await tx
      .insert(commentReactions)
      .values({ commentId, userId: scope.userId, orgId: scope.orgId, emoji })
      // A double click can race; the second insert is then a no-op.
      .onConflictDoNothing();
    return { task, reacted: true };
  });
  publishBoardEvent(task.projectId, {
    type: "comment.changed",
    taskId: task.id,
    actorId: scope.userId,
  });
  return { reacted };
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
