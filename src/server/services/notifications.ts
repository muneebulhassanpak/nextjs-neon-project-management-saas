import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { extractMentions } from "@/lib/mentions";
import { comments, notifications, projects, tasks, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";

import type { Person } from "./projects";
import type { Scope } from "./scope";

export type NotificationType = "mention" | "assigned";

/**
 * Notifies `recipients` about a task. The actor is never notified about their own action.
 * Recipients must be able to see the task; callers pass people from the project.
 */
export async function notify(
  tx: Transaction,
  scope: Scope,
  input: { type: NotificationType; taskId: string; recipients: string[]; commentId?: string },
): Promise<void> {
  const recipients = [...new Set(input.recipients)].filter((id) => id !== scope.userId);
  if (recipients.length === 0) return;
  await tx.insert(notifications).values(
    recipients.map((userId) => ({
      orgId: scope.orgId,
      userId,
      actorId: scope.userId,
      type: input.type,
      taskId: input.taskId,
      commentId: input.commentId ?? null,
    })),
  );
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  createdAt: Date;
  read: boolean;
  actor: Person | null;
  task: { id: string; title: string; projectId: string; projectName: string };
  /** The comment's text, for mentions. */
  comment: string | null;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
  /** Names of the people mentioned in the comments, by id. */
  people: Record<string, string>;
}

/** The user's latest notifications in this organization, and how many are unread. */
export async function listNotifications(scope: Scope, limit = 20): Promise<NotificationList> {
  return withOrgContext(scope, async (tx) => {
    const mine = and(eq(notifications.userId, scope.userId), eq(notifications.orgId, scope.orgId));
    const rows = await tx
      .select({
        id: notifications.id,
        type: notifications.type,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        actorId: user.id,
        actorName: user.name,
        actorImage: user.image,
        taskId: tasks.id,
        taskTitle: tasks.title,
        projectId: projects.id,
        projectName: projects.name,
        comment: comments.body,
      })
      .from(notifications)
      .innerJoin(tasks, eq(tasks.id, notifications.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(user, eq(user.id, notifications.actorId))
      .leftJoin(comments, eq(comments.id, notifications.commentId))
      .where(mine)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit);
    const [unread] = await tx
      .select({ n: count() })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt)));

    const mentioned = [...new Set(rows.flatMap((row) => extractMentions(row.comment ?? "")))];
    const names =
      mentioned.length === 0
        ? []
        : await tx
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, mentioned));

    return {
      unread: unread?.n ?? 0,
      people: Object.fromEntries(names.map((person) => [person.id, person.name])),
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        createdAt: row.createdAt,
        read: row.readAt !== null,
        actor: row.actorId
          ? { id: row.actorId, name: row.actorName ?? "", image: row.actorImage }
          : null,
        task: {
          id: row.taskId,
          title: row.taskTitle,
          projectId: row.projectId,
          projectName: row.projectName,
        },
        comment: row.comment,
      })),
    };
  });
}

/** Marks the given notifications (or all of them) as read. */
export async function markNotificationsRead(scope: Scope, ids: string[] | "all"): Promise<void> {
  await withOrgContext(scope, async (tx) => {
    const conditions = [
      eq(notifications.userId, scope.userId),
      eq(notifications.orgId, scope.orgId),
      isNull(notifications.readAt),
    ];
    if (ids !== "all") {
      if (ids.length === 0) return;
      conditions.push(inArray(notifications.id, ids));
    }
    await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(...conditions));
  });
}
