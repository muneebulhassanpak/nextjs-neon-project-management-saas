import { beforeEach, describe, expect, it } from "vitest";

import {
  addChecklistItemAction,
  bulkChangeTasksAction,
  createLabelAction,
  createTaskAction,
  deleteChecklistItemAction,
  moveTaskAction,
  updateChecklistItemAction,
  updateTaskAction,
} from "@/server/actions/board";
import { addCommentAction, toggleReactionAction } from "@/server/actions/collaboration";
import { setProjectArchivedAction } from "@/server/actions/projects";
import type { ActionResult } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import { listComments } from "@/server/services/comments";
import { listMyWork } from "@/server/services/my-work";
import { getTask } from "@/server/services/tasks";

import { clearPublished, publishedEvents } from "./helpers/realtime";
import { actAs } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Action failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

/** A team with a "Website" project that Alice is assigned to (Bob isn't), and three tasks. */
async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
  const board = await getBoard({ userId: owner.id, orgId: org.id }, projectId);
  const columns = board.columns.map((c) => c.id);
  const [todo = ""] = columns;
  actAs(owner);
  const tasks: string[] = [];
  for (const title of ["One", "Two", "Three"]) {
    tasks.push(unwrap(await createTaskAction({ orgId: org.id, columnId: todo, title })).id);
  }
  clearPublished();
  return { ...people, projectId, columns, tasks };
}

beforeEach(() => {
  clearPublished();
});

describe("checklists", () => {
  it("are added, ticked, renamed and removed, and counted on the board", async () => {
    const { org, alice, projectId, tasks } = await setup();
    const [taskId = ""] = tasks;
    const scope = { userId: alice.id, orgId: org.id };
    actAs(alice);

    const first = unwrap(await addChecklistItemAction({ orgId: org.id, taskId, title: " Wire " }));
    const second = unwrap(await addChecklistItemAction({ orgId: org.id, taskId, title: "Ship" }));
    unwrap(
      await updateChecklistItemAction({ orgId: org.id, itemId: first.id, changes: { done: true } }),
    );
    unwrap(
      await updateChecklistItemAction({
        orgId: org.id,
        itemId: second.id,
        changes: { title: "Ship it" },
      }),
    );

    expect((await getTask(scope, taskId))?.checklist).toEqual([
      { id: first.id, title: "Wire", done: true },
      { id: second.id, title: "Ship it", done: false },
    ]);
    const card = (await getBoard(scope, projectId)).tasks.find((t) => t.id === taskId);
    expect(card?.checklist).toEqual({ done: 1, total: 2 });

    unwrap(await deleteChecklistItemAction({ orgId: org.id, itemId: first.id }));
    unwrap(await deleteChecklistItemAction({ orgId: org.id, itemId: second.id }));
    const after = (await getBoard(scope, projectId)).tasks.find((t) => t.id === taskId);
    expect(after?.checklist).toBeNull();

    const events = await publishedEvents();
    expect(events).toHaveLength(6);
    expect(new Set(events.map((e) => e.event.type))).toEqual(new Set(["task.updated"]));
  });

  it("can't be read or changed by people who can't see the task", async () => {
    const { org, owner, bob, tasks } = await setup();
    const [taskId = ""] = tasks;
    actAs(owner);
    const item = unwrap(await addChecklistItemAction({ orgId: org.id, taskId, title: "Secret" }));
    const other = await team();

    actAs(bob);
    expect(await addChecklistItemAction({ orgId: org.id, taskId, title: "x" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(
      await updateChecklistItemAction({ orgId: org.id, itemId: item.id, changes: { done: true } }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await deleteChecklistItemAction({ orgId: org.id, itemId: item.id })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    actAs(other.owner);
    expect(await deleteChecklistItemAction({ orgId: other.org.id, itemId: item.id })).toMatchObject(
      { ok: false, error: { code: "not_found" } },
    );

    // Clients can't change checklists.
    actAs(other.client);
    expect(await addChecklistItemAction({ orgId: other.org.id, taskId, title: "x" })).toMatchObject(
      { ok: false, error: { code: "forbidden" } },
    );
  });

  it("reject empty and over-long items", async () => {
    const { org, owner, tasks } = await setup();
    const [taskId = ""] = tasks;
    actAs(owner);

    expect(await addChecklistItemAction({ orgId: org.id, taskId, title: "  " })).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
    expect(
      await addChecklistItemAction({ orgId: org.id, taskId, title: "x".repeat(201) }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });
});

describe("bulk changes", () => {
  it("move tasks to the bottom of a column, keeping their order, in one event", async () => {
    const { org, alice, projectId, columns, tasks } = await setup();
    const [, doing = ""] = columns;
    const [one = "", two = "", three = ""] = tasks;
    actAs(alice);
    const existing = unwrap(await createTaskAction({ orgId: org.id, columnId: doing, title: "X" }));
    clearPublished();

    // Passed out of order; they keep their board order.
    const result = unwrap(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [three, one, two],
        change: { kind: "move", columnId: doing },
      }),
    );

    expect(result).toEqual({ changed: 3 });
    const board = await getBoard({ userId: alice.id, orgId: org.id }, projectId);
    const inDoing = board.tasks
      .filter((t) => t.columnId === doing)
      .sort((a, b) => (a.position < b.position ? -1 : 1))
      .map((t) => t.id);
    expect(inDoing).toEqual([existing.id, one, two, three]);
    expect(await publishedEvents()).toEqual([
      { projectId, event: { type: "board.changed", actorId: alice.id } },
    ]);
  });

  it("assign, set priority and add a label, skipping tasks that already match", async () => {
    const { org, owner, alice, projectId, tasks } = await setup();
    const [one = "", two = ""] = tasks;
    const scope = { userId: owner.id, orgId: org.id };
    actAs(owner);
    unwrap(await updateTaskAction({ orgId: org.id, taskId: one, changes: { priority: "high" } }));
    const label = unwrap(await createLabelAction({ orgId: org.id, name: "Bug" }));

    expect(
      unwrap(
        await bulkChangeTasksAction({
          orgId: org.id,
          taskIds: [one, two],
          change: { kind: "priority", priority: "high" },
        }),
      ),
    ).toEqual({ changed: 1 });
    unwrap(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [one, two],
        change: { kind: "assign", assigneeId: alice.id },
      }),
    );
    unwrap(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [one, two],
        change: { kind: "label", labelId: label.id },
      }),
    );
    expect(
      unwrap(
        await bulkChangeTasksAction({
          orgId: org.id,
          taskIds: [one, two],
          change: { kind: "label", labelId: label.id },
        }),
      ),
    ).toEqual({ changed: 0 });

    const board = await getBoard(scope, projectId);
    for (const id of [one, two]) {
      const task = board.tasks.find((t) => t.id === id);
      expect(task).toMatchObject({ priority: "high", assignee: { id: alice.id } });
      expect(task?.labels.map((l) => l.name)).toEqual(["Bug"]);
    }
  });

  it("refuse assignees who aren't on the project", async () => {
    const { org, owner, bob, tasks } = await setup();
    actAs(owner);

    expect(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: tasks,
        change: { kind: "assign", assigneeId: bob.id },
      }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });

  it("delete all or nothing: a member can't delete a teammate's task", async () => {
    const { org, alice, projectId, columns, tasks } = await setup();
    const [todo = ""] = columns;
    actAs(alice);
    const mine = unwrap(await createTaskAction({ orgId: org.id, columnId: todo, title: "Mine" }));

    expect(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [mine.id, ...tasks],
        change: { kind: "delete" },
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const board = await getBoard({ userId: alice.id, orgId: org.id }, projectId);
    expect(board.tasks).toHaveLength(4);

    unwrap(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [mine.id],
        change: { kind: "delete" },
      }),
    );
    expect((await getBoard({ userId: alice.id, orgId: org.id }, projectId)).tasks).toHaveLength(3);
  });

  it("only work on tasks from one project that the user can see", async () => {
    const { org, owner, bob, tasks } = await setup();
    const other = await projectFor(owner, org.id, "Other");
    const [otherTodo = ""] = (
      await getBoard({ userId: owner.id, orgId: org.id }, other)
    ).columns.map((c) => c.id);
    actAs(owner);
    const elsewhere = unwrap(
      await createTaskAction({ orgId: org.id, columnId: otherTodo, title: "Elsewhere" }),
    );
    clearPublished();

    expect(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: [...tasks, elsewhere.id],
        change: { kind: "priority", priority: "low" },
      }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });

    actAs(bob);
    expect(
      await bulkChangeTasksAction({
        orgId: org.id,
        taskIds: tasks,
        change: { kind: "priority", priority: "low" },
      }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await publishedEvents()).toEqual([]);
  });

  it("are limited to 100 tasks", async () => {
    const { org, owner } = await setup();
    actAs(owner);
    const ids = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );

    expect(
      await bulkChangeTasksAction({ orgId: org.id, taskIds: ids, change: { kind: "delete" } }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });
});

describe("reactions", () => {
  it("toggle per person and emoji, and show who reacted", async () => {
    const { org, owner, alice, tasks } = await setup();
    const [taskId = ""] = tasks;
    actAs(owner);
    const comment = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "Ship it" }));
    clearPublished();

    unwrap(await toggleReactionAction({ orgId: org.id, commentId: comment.id, emoji: "🎉" }));
    actAs(alice);
    unwrap(await toggleReactionAction({ orgId: org.id, commentId: comment.id, emoji: "🎉" }));
    unwrap(await toggleReactionAction({ orgId: org.id, commentId: comment.id, emoji: "👍" }));

    const [listed] = await listComments({ userId: alice.id, orgId: org.id }, taskId);
    expect(listed?.reactions).toEqual([
      { emoji: "👍", count: 1, mine: true, people: [alice.name] },
      { emoji: "🎉", count: 2, mine: true, people: [owner.name, alice.name] },
    ]);

    // Toggling again takes Alice's reaction back.
    expect(
      unwrap(await toggleReactionAction({ orgId: org.id, commentId: comment.id, emoji: "🎉" })),
    ).toEqual({ reacted: false });
    const [ownersView] = await listComments({ userId: owner.id, orgId: org.id }, taskId);
    expect(ownersView?.reactions).toEqual([
      { emoji: "👍", count: 1, mine: false, people: [alice.name] },
      { emoji: "🎉", count: 1, mine: true, people: [owner.name] },
    ]);
    expect((await publishedEvents()).map((e) => e.event.type)).toEqual(
      Array(4).fill("comment.changed"),
    );
  });

  it("are refused for unknown emoji and for people who can't see the comment", async () => {
    const { org, owner, bob, tasks } = await setup();
    const [taskId = ""] = tasks;
    actAs(owner);
    const comment = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "Hi" }));

    expect(
      await toggleReactionAction({
        orgId: org.id,
        commentId: comment.id,
        emoji: "💩" as "👍",
      }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
    actAs(bob);
    expect(
      await toggleReactionAction({ orgId: org.id, commentId: comment.id, emoji: "👍" }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("my work", () => {
  it("lists the user's tasks in active projects they can see, marking the done column", async () => {
    const { org, owner, alice, projectId, columns, tasks } = await setup();
    const [one = "", two = "", three = ""] = tasks;
    const done = columns.at(-1) ?? "";
    actAs(owner);
    for (const taskId of [one, two]) {
      unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: alice.id } }));
    }
    unwrap(
      await updateTaskAction({ orgId: org.id, taskId: one, changes: { dueDate: "2030-01-02" } }),
    );
    unwrap(await moveTaskAction({ orgId: org.id, taskId: two, columnId: done, afterTaskId: null }));
    unwrap(
      await updateTaskAction({ orgId: org.id, taskId: three, changes: { assigneeId: owner.id } }),
    );
    // A task in an archived project doesn't count.
    const archived = await projectFor(owner, org.id, "Old", [alice.id]);
    const [oldTodo = ""] = (
      await getBoard({ userId: owner.id, orgId: org.id }, archived)
    ).columns.map((c) => c.id);
    actAs(owner);
    const old = unwrap(await createTaskAction({ orgId: org.id, columnId: oldTodo, title: "Old" }));
    unwrap(
      await updateTaskAction({ orgId: org.id, taskId: old.id, changes: { assigneeId: alice.id } }),
    );
    unwrap(await setProjectArchivedAction({ orgId: org.id, projectId: archived, archived: true }));

    const work = await listMyWork({ userId: alice.id, orgId: org.id });

    expect(work.map((t) => [t.title, t.done, t.dueDate, t.projectName])).toEqual([
      ["One", false, "2030-01-02", "Website"],
      ["Two", true, null, "Website"],
    ]);
    expect(work[0]).toMatchObject({ projectId, columnName: "To do", checklist: null });
  });
});
