import { describe, expect, it } from "vitest";

import { GET as getBoardRoute } from "@/app/api/orgs/[orgId]/projects/[projectId]/board/route";
import { GET as getTaskRoute } from "@/app/api/orgs/[orgId]/tasks/[taskId]/route";
import { createTaskAction } from "@/server/actions/board";
import { getBoard } from "@/server/services/board";

import { request } from "../setup/request-scope";
import { actAs } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

const MISSING = "00000000-0000-4000-8000-000000000000";

const board = (orgId: string, projectId: string) =>
  getBoardRoute(new Request("http://test"), { params: Promise.resolve({ orgId, projectId }) });
const task = (orgId: string, taskId: string) =>
  getTaskRoute(new Request("http://test"), { params: Promise.resolve({ orgId, taskId }) });

async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
  const [column] = (await getBoard({ userId: owner.id, orgId: org.id }, projectId)).columns;
  actAs(owner);
  const created = await createTaskAction({ orgId: org.id, columnId: column?.id ?? "", title: "A" });
  if (!created.ok) throw new Error("Task was not created");
  return { ...people, projectId, taskId: created.data.id };
}

describe("GET /api/orgs/:orgId/projects/:projectId/board", () => {
  it("returns the board to people on the project", async () => {
    const { org, alice, projectId } = await setup();
    actAs(alice);

    const response = await board(org.id, projectId);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { columns: unknown[]; tasks: { title: string }[] };
    expect(body.columns).toHaveLength(4);
    expect(body.tasks.map((t) => t.title)).toEqual(["A"]);
  });

  it("requires a session", async () => {
    const { org, projectId } = await setup();
    request.headers = new Headers();

    expect((await board(org.id, projectId)).status).toBe(401);
  });

  it("returns 404 to unassigned members, outsiders and for bad ids", async () => {
    const { org, bob, projectId } = await setup();
    const other = await team();

    actAs(bob);
    expect((await board(org.id, projectId)).status).toBe(404);
    expect((await board(org.id, "not-a-uuid")).status).toBe(404);
    expect((await board(org.id, MISSING)).status).toBe(404);
    actAs(other.owner);
    expect((await board(org.id, projectId)).status).toBe(404);
    expect((await board(other.org.id, projectId)).status).toBe(404);
  });
});

describe("GET /api/orgs/:orgId/tasks/:taskId", () => {
  it("returns the task to people on the project", async () => {
    const { org, alice, taskId } = await setup();
    actAs(alice);

    const response = await task(org.id, taskId);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: taskId, title: "A", labels: [] });
  });

  it("returns 401 without a session and 404 to anyone who can't see it", async () => {
    const { org, bob, taskId } = await setup();

    request.headers = new Headers();
    expect((await task(org.id, taskId)).status).toBe(401);
    actAs(bob);
    expect((await task(org.id, taskId)).status).toBe(404);
    expect((await task(org.id, "nope")).status).toBe(404);
  });
});
