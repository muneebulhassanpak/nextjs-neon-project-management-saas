import { randomUUID } from "node:crypto";

import { initialPositions } from "@/lib/positions";
import { DEFAULT_COLUMNS } from "@/lib/projects";
import type { Role } from "@/lib/roles";
import { db } from "@/server/db/client";
import {
  boardColumns,
  invitation,
  labels,
  member,
  organization,
  projectMembers,
  projects,
  tasks,
  user,
} from "@/server/db/schema";

function first<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error("Insert returned no rows");
  return row;
}

/** Test data, inserted as the owner role (like Better Auth does), bypassing RLS. */
export async function createUser(name = "Test User") {
  const id = randomUUID();
  return first(
    await db
      .insert(user)
      .values({ id, name, email: `${id}@example.com`, emailVerified: true })
      .returning(),
  );
}

export async function createOrganization(name = "Test Org") {
  const id = randomUUID();
  return first(
    await db
      .insert(organization)
      .values({ id, name, slug: `org-${id}`, createdAt: new Date() })
      .returning(),
  );
}

export async function addMember(organizationId: string, userId: string, role: Role = "member") {
  return first(
    await db
      .insert(member)
      .values({ id: randomUUID(), organizationId, userId, role, createdAt: new Date() })
      .returning(),
  );
}

export async function createInvitation(organizationId: string, inviterId: string, email: string) {
  return first(
    await db
      .insert(invitation)
      .values({
        id: randomUUID(),
        organizationId,
        inviterId,
        email,
        role: "member",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning(),
  );
}

/** Two organizations, each with an owner and a pending invitation. */
export async function createTwoTenants() {
  const alice = await createUser("Alice");
  const bob = await createUser("Bob");
  const acme = await createOrganization("Acme");
  const globex = await createOrganization("Globex");
  await addMember(acme.id, alice.id, "owner");
  await addMember(globex.id, bob.id, "owner");
  const acmeInvite = await createInvitation(acme.id, alice.id, "new-acme@example.com");
  const globexInvite = await createInvitation(globex.id, bob.id, "new-globex@example.com");
  return { alice, bob, acme, globex, acmeInvite, globexInvite };
}

/** A project with the default columns, inserted as the owner role (bypassing RLS). */
export async function createProject(orgId: string, name = "Website", memberIds: string[] = []) {
  const project = first(await db.insert(projects).values({ orgId, name }).returning());
  const keys = initialPositions(DEFAULT_COLUMNS.length);
  const columns = await db
    .insert(boardColumns)
    .values(
      DEFAULT_COLUMNS.map((columnName, i) => ({
        orgId,
        projectId: project.id,
        name: columnName,
        position: keys[i] ?? "a0",
      })),
    )
    .returning();
  if (memberIds.length > 0) {
    await db
      .insert(projectMembers)
      .values(memberIds.map((userId) => ({ projectId: project.id, orgId, userId })));
  }
  return { ...project, columns };
}

export async function createTask(
  project: { id: string; orgId: string; columns: { id: string }[] },
  title = "Task",
  createdBy: string | null = null,
  position = "a0",
) {
  return first(
    await db
      .insert(tasks)
      .values({
        orgId: project.orgId,
        projectId: project.id,
        columnId: first(project.columns).id,
        title,
        position,
        createdBy,
      })
      .returning(),
  );
}

export async function createLabel(orgId: string, name = "Bug", color = "red") {
  return first(await db.insert(labels).values({ orgId, name, color }).returning());
}
