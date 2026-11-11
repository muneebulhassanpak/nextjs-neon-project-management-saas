import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  boardColumns,
  labels,
  projectMembers,
  projects,
  taskLabels,
  tasks,
} from "@/server/db/schema";
import { withOrgContext, type TenantContext } from "@/server/db/tenant";

import {
  addMember,
  createLabel,
  createOrganization,
  createProject,
  createTask,
  createUser,
} from "./helpers/factories";

/** Postgres refuses a write that a policy doesn't allow with insufficient_privilege. */
const DENIED = { cause: { code: "42501" } };

function as(userId: string, orgId: string): TenantContext {
  return { userId, orgId };
}

async function setup() {
  const acme = await createOrganization("Acme");
  const globex = await createOrganization("Globex");
  const [owner, admin, assigned, unassigned, client, outsider] = await Promise.all(
    ["Owner", "Admin", "Assigned", "Unassigned", "Client", "Outsider"].map((name) =>
      createUser(name),
    ),
  );
  if (!owner || !admin || !assigned || !unassigned || !client || !outsider) {
    throw new Error("users not created");
  }
  await addMember(acme.id, owner.id, "owner");
  await addMember(acme.id, admin.id, "admin");
  await addMember(acme.id, assigned.id, "member");
  await addMember(acme.id, unassigned.id, "member");
  await addMember(acme.id, client.id, "client");
  await addMember(globex.id, outsider.id, "owner");

  const website = await createProject(acme.id, "Website", [assigned.id]);
  const mobile = await createProject(acme.id, "Mobile app");
  const secret = await createProject(globex.id, "Globex secret");
  const ownTask = await createTask(website, "Mine", assigned.id);
  const othersTask = await createTask(website, "Someone else's", admin.id, "a1");
  const bug = await createLabel(acme.id, "Bug");
  await db.insert(taskLabels).values({ taskId: ownTask.id, labelId: bug.id, orgId: acme.id });

  return {
    acme,
    globex,
    owner,
    admin,
    assigned,
    unassigned,
    client,
    outsider,
    website,
    mobile,
    secret,
    ownTask,
    othersTask,
    bug,
  };
}

describe("project row-level security", () => {
  let t: Awaited<ReturnType<typeof setup>>;

  beforeAll(async () => {
    t = await setup();
  });

  function visibleProjects(ctx: TenantContext) {
    return withOrgContext(ctx, (tx) => tx.select({ name: projects.name }).from(projects)).then(
      (rows) => rows.map((r) => r.name).sort(),
    );
  }

  it("shows owners and admins every project in the organization", async () => {
    expect(await visibleProjects(as(t.owner.id, t.acme.id))).toEqual(["Mobile app", "Website"]);
    expect(await visibleProjects(as(t.admin.id, t.acme.id))).toEqual(["Mobile app", "Website"]);
  });

  it("shows members only the projects they're assigned to", async () => {
    expect(await visibleProjects(as(t.assigned.id, t.acme.id))).toEqual(["Website"]);
    expect(await visibleProjects(as(t.unassigned.id, t.acme.id))).toEqual([]);
  });

  it("shows clients no projects yet", async () => {
    expect(await visibleProjects(as(t.client.id, t.acme.id))).toEqual([]);
  });

  it("shows nothing of another organization, even when asked for it", async () => {
    expect(await visibleProjects(as(t.outsider.id, t.acme.id))).toEqual([]);
    expect(await visibleProjects(as(t.owner.id, t.globex.id))).toEqual([]);
  });

  it("hides the columns, tasks and labels of projects a member can't see", async () => {
    const seen = await withOrgContext(as(t.unassigned.id, t.acme.id), async (tx) => ({
      columns: await tx.select().from(boardColumns),
      tasks: await tx.select().from(tasks),
      taskLabels: await tx.select().from(taskLabels),
      members: await tx.select().from(projectMembers),
    }));

    expect(seen).toEqual({ columns: [], tasks: [], taskLabels: [], members: [] });
  });

  it("lets only owners and admins create projects", async () => {
    await expect(
      withOrgContext(as(t.admin.id, t.acme.id), (tx) =>
        tx.insert(projects).values({ orgId: t.acme.id, name: "By admin" }),
      ),
    ).resolves.toBeDefined();
    await expect(
      withOrgContext(as(t.assigned.id, t.acme.id), (tx) =>
        tx.insert(projects).values({ orgId: t.acme.id, name: "By member" }),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it("doesn't let members add themselves to a project", async () => {
    await expect(
      withOrgContext(as(t.unassigned.id, t.acme.id), (tx) =>
        tx
          .insert(projectMembers)
          .values({ projectId: t.mobile.id, orgId: t.acme.id, userId: t.unassigned.id }),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it("lets assigned members add tasks, and nobody else", async () => {
    const task = (userId: string) =>
      withOrgContext(as(userId, t.acme.id), (tx) =>
        tx.insert(tasks).values({
          orgId: t.acme.id,
          projectId: t.website.id,
          columnId: t.website.columns[0]?.id ?? "",
          title: "New",
          position: "a5",
        }),
      );

    await expect(task(t.assigned.id)).resolves.toBeDefined();
    await expect(task(t.unassigned.id)).rejects.toMatchObject(DENIED);
    await expect(task(t.client.id)).rejects.toMatchObject(DENIED);
  });

  it("can't put a task into another organization's project", async () => {
    await expect(
      withOrgContext(as(t.owner.id, t.acme.id), (tx) =>
        tx.insert(tasks).values({
          orgId: t.acme.id,
          projectId: t.secret.id,
          columnId: t.secret.columns[0]?.id ?? "",
          title: "Sneaky",
          position: "a0",
        }),
      ),
    ).rejects.toThrow();
  });

  it("lets members delete only the tasks they created", async () => {
    const deleted = await withOrgContext(as(t.assigned.id, t.acme.id), async (tx) => ({
      others: await tx.delete(tasks).where(eq(tasks.id, t.othersTask.id)).returning(),
      own: await tx.delete(tasks).where(eq(tasks.id, t.ownTask.id)).returning(),
    }));

    expect(deleted.others).toEqual([]);
    expect(deleted.own.map((task) => task.id)).toEqual([t.ownTask.id]);
  });

  it("lets members create labels but only admins delete them", async () => {
    await expect(
      withOrgContext(as(t.assigned.id, t.acme.id), (tx) =>
        tx.insert(labels).values({ orgId: t.acme.id, name: "Design", color: "blue" }),
      ),
    ).resolves.toBeDefined();
    await expect(
      withOrgContext(as(t.client.id, t.acme.id), (tx) =>
        tx.insert(labels).values({ orgId: t.acme.id, name: "Nope", color: "blue" }),
      ),
    ).rejects.toMatchObject(DENIED);

    const byMember = await withOrgContext(as(t.assigned.id, t.acme.id), (tx) =>
      tx.delete(labels).where(eq(labels.id, t.bug.id)).returning(),
    );
    const byAdmin = await withOrgContext(as(t.admin.id, t.acme.id), (tx) =>
      tx.delete(labels).where(eq(labels.id, t.bug.id)).returning(),
    );

    expect(byMember).toEqual([]);
    expect(byAdmin.map((label) => label.id)).toEqual([t.bug.id]);
  });
});
