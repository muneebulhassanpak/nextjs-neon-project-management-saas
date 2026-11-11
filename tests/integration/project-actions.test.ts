import { describe, expect, it } from "vitest";

import {
  createProjectAction,
  setProjectArchivedAction,
  setProjectMembersAction,
  updateProjectAction,
} from "@/server/actions/projects";
import { getBoard } from "@/server/services/board";
import { getProject, listProjectAccess, listProjects } from "@/server/services/projects";

import { createTask } from "./helpers/factories";
import { form } from "./helpers/forms";
import { actAs } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

describe("createProjectAction", () => {
  it("creates a project with the default columns and opens its board", async () => {
    const { org, admin, alice } = await team();

    const projectId = await projectFor(admin, org.id, "Website", [alice.id]);

    const board = await getBoard({ userId: admin.id, orgId: org.id }, projectId);
    expect(board.columns.map((c) => c.name)).toEqual(["To do", "In progress", "Review", "Done"]);
    expect(board.people.map((p) => p.name).sort()).toEqual(["Admin", "Alice", "Owner"]);
  });

  it("returns field errors for a missing name", async () => {
    const { org, owner } = await team();
    actAs(owner);

    const result = await createProjectAction(
      null,
      form({ orgId: org.id, name: " ", description: "" }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });

  it.each(["alice", "client"] as const)("is refused for a %s", async (who) => {
    const people = await team();
    actAs(people[who]);

    const result = await createProjectAction(
      null,
      form({ orgId: people.org.id, name: "Nope", description: "" }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("only assigns members, not admins or clients", async () => {
    const { org, owner, client } = await team();
    actAs(owner);
    const data = form({ orgId: org.id, name: "Website", description: "" });
    data.append("memberIds", client.id);

    expect(await createProjectAction(null, data)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });
});

describe("project access", () => {
  it("shows members only the projects they're on, and adding them grants access", async () => {
    const { org, owner, alice, bob } = await team();
    const website = await projectFor(owner, org.id, "Website", [alice.id]);
    await projectFor(owner, org.id, "Mobile app");

    const names = async (userId: string) =>
      (await listProjects({ userId, orgId: org.id })).map((p) => p.name).sort();
    expect(await names(owner.id)).toEqual(["Mobile app", "Website"]);
    expect(await names(alice.id)).toEqual(["Website"]);
    expect(await names(bob.id)).toEqual([]);

    actAs(owner);
    expect(
      await setProjectMembersAction({ orgId: org.id, projectId: website, userIds: [bob.id] }),
    ).toEqual({ ok: true, data: null });
    expect(await names(alice.id)).toEqual([]);
    expect(await names(bob.id)).toEqual(["Website"]);

    const access = await listProjectAccess({ userId: owner.id, orgId: org.id }, website);
    expect(access.map((row) => [row.name, row.hasAccess])).toEqual([
      ["Admin", true],
      ["Alice", false],
      ["Bob", true],
      ["Owner", true],
    ]);
  });

  it("doesn't let members change who's on a project", async () => {
    const { org, owner, alice, bob } = await team();
    const website = await projectFor(owner, org.id, "Website", [alice.id]);
    actAs(alice);

    expect(
      await setProjectMembersAction({ orgId: org.id, projectId: website, userIds: [bob.id] }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("updating and archiving", () => {
  it("renames, changes the status, archives and restores", async () => {
    const { org, owner } = await team();
    const projectId = await projectFor(owner, org.id, "Website");
    const scope = { userId: owner.id, orgId: org.id };
    actAs(owner);

    expect(
      await updateProjectAction(
        null,
        form({
          orgId: org.id,
          projectId,
          name: "Website v2",
          description: "Relaunch",
          status: "on_hold",
        }),
      ),
    ).toEqual({ ok: true, data: null });
    expect(await getProject(scope, projectId)).toMatchObject({
      name: "Website v2",
      description: "Relaunch",
      status: "on_hold",
    });

    await setProjectArchivedAction({ orgId: org.id, projectId, archived: true });
    expect(await listProjects(scope)).toEqual([]);
    expect((await listProjects(scope, { archived: true })).map((p) => p.name)).toEqual([
      "Website v2",
    ]);

    await setProjectArchivedAction({ orgId: org.id, projectId, archived: false });
    expect((await listProjects(scope)).map((p) => p.name)).toEqual(["Website v2"]);
  });

  it("counts tasks and lists assigned members", async () => {
    const { org, owner, alice } = await team();
    const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
    const board = await getBoard({ userId: owner.id, orgId: org.id }, projectId);
    const project = {
      id: projectId,
      orgId: org.id,
      columns: board.columns,
    };
    await createTask(project, "One");
    await createTask(project, "Two", null, "a1");

    const [summary] = await listProjects({ userId: owner.id, orgId: org.id });
    expect(summary).toMatchObject({ taskCount: 2, members: [{ name: "Alice" }] });
  });

  it("reports projects that don't exist", async () => {
    const { org, owner } = await team();
    actAs(owner);

    expect(
      await setProjectArchivedAction({
        orgId: org.id,
        projectId: "00000000-0000-4000-8000-000000000000",
        archived: true,
      }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
