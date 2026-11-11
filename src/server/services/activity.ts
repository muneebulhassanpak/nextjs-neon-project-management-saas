import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import type { ActivityAction, ActivityEvent } from "@/lib/activity";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { activityLog, projects, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";

import type { Person } from "./projects";
import type { Scope } from "./scope";

/**
 * Records an action in the same transaction as the change itself, so the log never claims
 * something happened that was rolled back (or misses something that wasn't).
 */
export async function logActivity(
  tx: Transaction,
  scope: Scope,
  event: ActivityEvent & { projectId?: string | null; taskId?: string | null },
): Promise<void> {
  await tx.insert(activityLog).values({
    orgId: scope.orgId,
    projectId: event.projectId ?? null,
    taskId: event.taskId ?? null,
    actorId: scope.userId,
    action: event.action,
    metadata: event.metadata,
  });
}

/** Logs that the current user joined the organization (after accepting an invitation). */
export async function recordMemberJoined(scope: Scope, role: Role): Promise<void> {
  await withOrgContext(scope, (tx) =>
    logActivity(tx, scope, { action: "member.joined", metadata: { role: ROLE_LABELS[role] } }),
  );
}

/** Whether the current user logged `action` on this task in the last `seconds`. */
export async function loggedRecently(
  tx: Transaction,
  scope: Scope,
  taskId: string,
  action: ActivityAction,
  seconds: number,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.taskId, taskId),
        eq(activityLog.actorId, scope.userId),
        eq(activityLog.action, action),
        sql`${activityLog.createdAt} > now() - make_interval(secs => ${seconds})`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type ActivityItem = ActivityEvent & {
  id: string;
  createdAt: Date;
  actor: Person | null;
  project: { id: string; name: string } | null;
  taskId: string | null;
};

export interface ActivityPage {
  items: ActivityItem[];
  /** Pass back to get the next (older) page: the last item's id. Null when there's nothing older. */
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

/**
 * The newest activity first, for the organization, one project or one task. Row-level security
 * leaves out projects the user can't see (and organization events for non-admins).
 */
export async function listActivity(
  scope: Scope,
  filter: { projectId?: string; taskId?: string; cursor?: string | null } = {},
): Promise<ActivityPage> {
  const conditions: SQL[] = [eq(activityLog.orgId, scope.orgId)];
  if (filter.projectId) conditions.push(eq(activityLog.projectId, filter.projectId));
  if (filter.taskId) conditions.push(eq(activityLog.taskId, filter.taskId));
  if (filter.cursor) {
    // Compared in SQL: timestamps have microseconds, which a JS Date would round away.
    conditions.push(
      sql`(${activityLog.createdAt}, ${activityLog.id}) < (
        select c.created_at, c.id from activity_log c where c.id = ${filter.cursor}
      )`,
    );
  }

  const rows = await withOrgContext(scope, (tx) =>
    tx
      .select({
        id: activityLog.id,
        action: activityLog.action,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        taskId: activityLog.taskId,
        projectId: projects.id,
        projectName: projects.name,
        actorId: user.id,
        actorName: user.name,
        actorImage: user.image,
      })
      .from(activityLog)
      .leftJoin(projects, eq(projects.id, activityLog.projectId))
      .leftJoin(user, eq(user.id, activityLog.actorId))
      .where(and(...conditions))
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(PAGE_SIZE + 1),
  );

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      taskId: row.taskId,
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName ?? "", image: row.actorImage }
        : null,
      project: row.projectId ? { id: row.projectId, name: row.projectName ?? "" } : null,
      ...({ action: row.action, metadata: row.metadata } as ActivityEvent),
    })),
    nextCursor: rows.length > PAGE_SIZE && last ? last.id : null,
  };
}
