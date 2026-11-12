import { beforeEach, describe, expect, it } from "vitest";

import { GET as getRealtimeRoute } from "@/app/api/orgs/[orgId]/projects/[projectId]/realtime/route";
import {
  createColumnAction,
  createTaskAction,
  deleteColumnAction,
  deleteTaskAction,
  moveColumnAction,
  moveTaskAction,
  renameColumnAction,
  updateTaskAction,
} from "@/server/actions/board";
import {
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
} from "@/server/actions/collaboration";
import type { ActionResult } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import { verifyToken } from "@realtime/protocol";

import { request } from "../setup/request-scope";
import { clearPublished, publishedEvents } from "./helpers/realtime";
import { actAs } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

const SECRET = "integration-realtime-secret-0000000000";
const MISSING = "00000000-0000-4000-8000-000000000000";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Action failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

const connect = (orgId: string, projectId: string) =>
  getRealtimeRoute(new Request("http://test"), { params: Promise.resolve({ orgId, projectId }) });

/** A team with a "Website" project that Alice is assigned to (Bob isn't). */
async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
  const columns = (await getBoard({ userId: owner.id, orgId: org.id }, projectId)).columns;
  clearPublished();
  return { ...people, projectId, columns: columns.map((c) => c.id) };
}

beforeEach(() => {
  clearPublished();
});

describe("GET /api/orgs/:orgId/projects/:projectId/realtime", () => {
  it("gives people on the project a short-lived token for the board's room", async () => {
    const { org, alice, projectId } = await setup();
    actAs(alice);

    const response = await connect(org.id, projectId);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { url, token } = (await response.json()) as { url: string; token: string };
    expect(url).toBe(`ws://realtime.test/rooms/${projectId}/connect`);
    const claims = await verifyToken(token, SECRET);
    expect(claims).toMatchObject({ id: alice.id, name: alice.name, room: projectId });
    expect(claims?.exp).toBeGreaterThan(Date.now() / 1000);
    expect(claims?.exp).toBeLessThanOrEqual(Date.now() / 1000 + 60);
  });

  it("requires a session", async () => {
    const { org, projectId } = await setup();
    request.headers = new Headers();

    expect((await connect(org.id, projectId)).status).toBe(401);
  });

  it("returns 404 to unassigned members, outsiders and for bad ids", async () => {
    const { org, bob, projectId } = await setup();
    const other = await team();

    actAs(bob);
    expect((await connect(org.id, projectId)).status).toBe(404);
    expect((await connect(org.id, "not-a-uuid")).status).toBe(404);
    expect((await connect(org.id, MISSING)).status).toBe(404);
    actAs(other.owner);
    expect((await connect(org.id, projectId)).status).toBe(404);
    expect((await connect(other.org.id, projectId)).status).toBe(404);
  });
});

describe("board events", () => {
  it("are published after each task change, with who made it", async () => {
    const { org, alice, projectId, columns } = await setup();
    const [todo = "", doing = ""] = columns;
    actAs(alice);

    const { id: taskId } = unwrap(
      await createTaskAction({ orgId: org.id, columnId: todo, title: "Hero" }),
    );
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { priority: "high" } }));
    unwrap(await moveTaskAction({ orgId: org.id, taskId, columnId: doing, afterTaskId: null }));
    unwrap(await deleteTaskAction({ orgId: org.id, taskId }));

    const events = await publishedEvents();
    expect(events.map((e) => e.projectId)).toEqual(Array(4).fill(projectId));
    expect(events.map((e) => e.event)).toEqual([
      { type: "task.created", taskId, actorId: alice.id },
      { type: "task.updated", taskId, actorId: alice.id },
      { type: "task.moved", taskId, actorId: alice.id },
      { type: "task.deleted", taskId, actorId: alice.id },
    ]);
  });

  it("are published for column and comment changes", async () => {
    const { org, owner, projectId, columns } = await setup();
    const [todo = ""] = columns;
    actAs(owner);

    const column = unwrap(await createColumnAction({ orgId: org.id, projectId, name: "QA" }));
    unwrap(await renameColumnAction({ orgId: org.id, columnId: column.id, name: "Testing" }));
    unwrap(await moveColumnAction({ orgId: org.id, columnId: column.id, direction: "left" }));
    unwrap(await deleteColumnAction({ orgId: org.id, columnId: column.id, moveTasksTo: null }));
    const { id: taskId } = unwrap(
      await createTaskAction({ orgId: org.id, columnId: todo, title: "Hero" }),
    );
    const comment = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "On it" }));
    unwrap(await editCommentAction({ orgId: org.id, commentId: comment.id, body: "Done" }));
    unwrap(await deleteCommentAction({ orgId: org.id, commentId: comment.id }));

    const events = (await publishedEvents()).map((e) => e.event.type);
    expect(events).toEqual([
      "column.changed",
      "column.changed",
      "column.changed",
      "column.changed",
      "task.created",
      "comment.changed",
      "comment.changed",
      "comment.changed",
    ]);
  });

  it("aren't published when nothing changed or the change failed", async () => {
    const { org, owner, bob, columns } = await setup();
    const [first = ""] = columns;
    actAs(owner);
    const { id: taskId } = unwrap(
      await createTaskAction({ orgId: org.id, columnId: first, title: "Hero" }),
    );
    clearPublished();

    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: {} }));
    // The first column can't move further left.
    unwrap(await moveColumnAction({ orgId: org.id, columnId: first, direction: "left" }));
    actAs(bob);
    expect((await deleteTaskAction({ orgId: org.id, taskId })).ok).toBe(false);

    expect(await publishedEvents()).toEqual([]);
  });
});
