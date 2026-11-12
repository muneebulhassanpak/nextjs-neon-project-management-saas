import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { todayIn } from "@/lib/dates";
import { initialPositions } from "@/lib/positions";
import { DEFAULT_COLUMNS, type ProjectStatus } from "@/lib/projects";
import { isRole, type Role } from "@/lib/roles";
import { boardColumns, member, projectMembers, projects, tasks, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";
import { NotFoundError, ValidationError } from "@/server/errors";

import { logActivity } from "./activity";
import { projectProgress, type ProjectProgress } from "./overview";

import type { Scope } from "./scope";

export interface Person {
  id: string;
  name: string;
  image: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
  taskCount: number;
  members: Person[];
  progress: ProjectProgress;
}

/**
 * Projects the user can see (RLS decides), newest first, with task counts, members and
 * progress. `today` (the viewer's date) decides what's overdue.
 */
export async function listProjects(
  scope: Scope,
  { archived = false, today = todayIn("UTC") }: { archived?: boolean; today?: string } = {},
): Promise<ProjectSummary[]> {
  return withOrgContext(scope, async (tx) => {
    const rows = await tx
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        archivedAt: projects.archivedAt,
        taskCount: count(tasks.id),
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.orgId, scope.orgId),
          archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
        ),
      )
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt));

    const ids = rows.map((r) => r.id);
    const [members, progress] = await Promise.all([
      membersOf(tx, ids),
      projectProgress(tx, ids, today),
    ]);
    return rows.map((row) => ({
      ...row,
      members: members.get(row.id) ?? [],
      progress: progress.get(row.id) ?? { total: 0, done: 0, overdue: 0, nextDue: null },
    }));
  });
}

async function membersOf(tx: Transaction, projectIds: string[]): Promise<Map<string, Person[]>> {
  const byProject = new Map<string, Person[]>();
  if (projectIds.length === 0) return byProject;
  const rows = await tx
    .select({
      projectId: projectMembers.projectId,
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(projectMembers)
    .innerJoin(user, eq(user.id, projectMembers.userId))
    .where(inArray(projectMembers.projectId, projectIds))
    .orderBy(asc(user.name));
  for (const { projectId, ...person } of rows) {
    byProject.set(projectId, [...(byProject.get(projectId) ?? []), person]);
  }
  return byProject;
}

export interface ProjectDetail {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
  /** Whether the current user is assigned to the project (owners and admins may not be). */
  assigned: boolean;
}

/** A project the user can see, or `null`. */
export async function getProject(scope: Scope, projectId: string): Promise<ProjectDetail | null> {
  return withOrgContext(scope, async (tx) => {
    const [row] = await tx
      .select({
        id: projects.id,
        orgId: projects.orgId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        archivedAt: projects.archivedAt,
        assigned: sql<boolean>`exists (
          select 1 from ${projectMembers}
          where ${projectMembers.projectId} = ${projects.id}
            and ${projectMembers.userId} = ${scope.userId}
        )`,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, scope.orgId)))
      .limit(1);
    return row ?? null;
  });
}

/** Creates a project with the default board columns and the chosen members. */
export async function createProject(
  scope: Scope,
  input: { name: string; description: string | null; memberIds: string[] },
): Promise<{ id: string }> {
  return withOrgContext(scope, async (tx) => {
    const memberIds = await assignableMemberIds(tx, scope.orgId, input.memberIds);
    const [project] = await tx
      .insert(projects)
      .values({
        orgId: scope.orgId,
        name: input.name,
        description: input.description,
        createdBy: scope.userId,
      })
      .returning({ id: projects.id });
    if (!project) throw new Error("Project insert returned no row");

    const keys = initialPositions(DEFAULT_COLUMNS.length);
    await tx.insert(boardColumns).values(
      DEFAULT_COLUMNS.map((name, i) => ({
        orgId: scope.orgId,
        projectId: project.id,
        name,
        position: keys[i] ?? "a0",
      })),
    );
    if (memberIds.length > 0) {
      await tx
        .insert(projectMembers)
        .values(memberIds.map((userId) => ({ projectId: project.id, orgId: scope.orgId, userId })));
    }
    await logActivity(tx, scope, {
      action: "project.created",
      projectId: project.id,
      metadata: { name: input.name },
    });
    return project;
  });
}

export async function updateProject(
  scope: Scope,
  projectId: string,
  input: { name: string; description: string | null; status: ProjectStatus },
): Promise<void> {
  await withOrgContext(scope, async (tx) => {
    const updated = await tx
      .update(projects)
      .set(input)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, scope.orgId)))
      .returning({ id: projects.id });
    if (updated.length === 0) throw new NotFoundError("This project no longer exists.");
    await logActivity(tx, scope, {
      action: "project.updated",
      projectId,
      metadata: { name: input.name },
    });
  });
}

/** Archives (hides from the list, keeps everything) or restores a project. */
export async function setProjectArchived(
  scope: Scope,
  projectId: string,
  archived: boolean,
): Promise<void> {
  await withOrgContext(scope, async (tx) => {
    const updated = await tx
      .update(projects)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(projects.id, projectId), eq(projects.orgId, scope.orgId)))
      .returning({ id: projects.id, name: projects.name });
    const [project] = updated;
    if (!project) throw new NotFoundError("This project no longer exists.");
    await logActivity(tx, scope, {
      action: archived ? "project.archived" : "project.restored",
      projectId,
      metadata: { name: project.name },
    });
  });
}

export interface ProjectAccessRow extends Person {
  email: string;
  role: Role;
  /** Owners and admins always have access; members only when assigned. */
  hasAccess: boolean;
}

/** Everyone in the organization who could work on the project, and whether they're on it. */
export async function listProjectAccess(
  scope: Scope,
  projectId: string,
): Promise<ProjectAccessRow[]> {
  return withOrgContext(scope, async (tx) => {
    const rows = await tx
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: member.role,
        assigned: sql<boolean>`${projectMembers.userId} is not null`,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .leftJoin(
        projectMembers,
        and(eq(projectMembers.userId, member.userId), eq(projectMembers.projectId, projectId)),
      )
      .where(eq(member.organizationId, scope.orgId))
      .orderBy(asc(user.name));

    return rows.flatMap(({ assigned, role, ...person }) => {
      if (!isRole(role) || role === "client") return [];
      const admin = role === "owner" || role === "admin";
      return [{ ...person, role, hasAccess: admin || assigned }];
    });
  });
}

/** Sets exactly which members are assigned to the project. */
export async function setProjectMembers(
  scope: Scope,
  projectId: string,
  userIds: string[],
): Promise<void> {
  await withOrgContext(scope, async (tx) => {
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, scope.orgId)));
    if (!project) throw new NotFoundError("This project no longer exists.");

    const wanted = await assignableMemberIds(tx, scope.orgId, userIds);
    const current = await tx
      .select({ id: projectMembers.userId, name: user.name })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));
    const removed = current.filter((person) => !wanted.includes(person.id));
    const addedIds = wanted.filter((id) => !current.some((person) => person.id === id));
    if (removed.length === 0 && addedIds.length === 0) return;

    const added =
      addedIds.length === 0
        ? []
        : await tx
            .select({ name: user.name })
            .from(user)
            .where(inArray(user.id, addedIds))
            .orderBy(asc(user.name));
    await logActivity(tx, scope, {
      action: "project.members",
      projectId,
      metadata: {
        name: project.name,
        added: added.map((person) => person.name),
        removed: removed.map((person) => person.name).sort(),
      },
    });
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    if (wanted.length > 0) {
      await tx
        .insert(projectMembers)
        .values(wanted.map((userId) => ({ projectId, orgId: scope.orgId, userId })));
    }
  });
}

/**
 * The ids from `userIds` that belong to members (role `member`) of the organization. Owners and
 * admins see every project without being assigned, and clients aren't assigned to boards.
 */
async function assignableMemberIds(
  tx: Transaction,
  orgId: string,
  userIds: string[],
): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  const rows = await tx
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), inArray(member.userId, unique)));
  const valid = rows.filter((row) => row.role === "member").map((row) => row.userId);
  if (valid.length !== unique.length) {
    throw new ValidationError("Only members of this organization can be added to a project.");
  }
  return valid;
}
