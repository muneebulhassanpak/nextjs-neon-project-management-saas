import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createColumnAction,
  createLabelAction,
  createTaskAction,
  deleteColumnAction,
  deleteTaskAction,
  moveColumnAction,
  moveTaskAction,
  renameColumnAction,
  setTaskLabelsAction,
  updateTaskAction,
} from "@/server/actions/board";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";
import type { ActionResult } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import { getTask } from "@/server/services/tasks";

import { actAs, type SignedInUser } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Action failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

/** A team with a "Website" project that Alice is assigned to (Bob isn't). */
async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
  const board = (as: SignedInUser = owner) => getBoard({ userId: as.id, orgId: org.id }, projectId);
  const columns = (await board()).columns;
  const [todo, doing] = columns.map((c) => c.id);
  if (!todo || !doing) throw new Error("Missing default columns");

  const addTask = async (title: string, columnId = todo, as: SignedInUser = owner) => {
    actAs(as);
    return unwrap(await createTaskAction({ orgId: org.id, columnId, title })).id;
  };
  const titlesIn = async (columnId: string) =>
    (await board()).tasks.filter((t) => t.columnId === columnId).map((t) => t.title);

  return { ...people, projectId, board, columns, todo, doing, addTask, titlesIn };
}

describe("tasks", () => {
  it("adds tasks to the bottom of a column", async () => {
    const { addTask, titlesIn, todo } = await setup();

    await addTask("First");
    await addTask("Second");
    await addTask("Third");

    expect(await titlesIn(todo)).toEqual(["First", "Second", "Third"]);
  });

  it("lets assigned members add tasks, but not other members or clients", async () => {
    const { org, alice, bob, client, todo, addTask, titlesIn } = await setup();

    await addTask("From Alice", todo, alice);
    for (const outsider of [bob, client]) {
      actAs(outsider);
      const result = await createTaskAction({ orgId: org.id, columnId: todo, title: "Nope" });
      expect(result).toMatchObject({ ok: false });
    }
    expect(await titlesIn(todo)).toEqual(["From Alice"]);
  });

  it("tells clients they can't change projects", async () => {
    const { org, client, todo } = await setup();
    actAs(client);

    expect(await createTaskAction({ orgId: org.id, columnId: todo, title: "Nope" })).toMatchObject({
      ok: false,
      error: { code: "forbidden", message: "Clients can't change projects." },
    });
  });

  it("rejects a blank title", async () => {
    const { org, owner, todo } = await setup();
    actAs(owner);

    expect(await createTaskAction({ orgId: org.id, columnId: todo, title: "  " })).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("updates fields and returns them in the task detail", async () => {
    const { org, owner, alice, addTask } = await setup();
    const taskId = await addTask("Write copy");
    const description = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hero and FAQ" }] }],
    };

    actAs(owner);
    unwrap(
      await updateTaskAction({
        orgId: org.id,
        taskId,
        changes: {
          title: "Write landing copy",
          priority: "high",
          dueDate: "2026-12-01",
          assigneeId: alice.id,
          description,
        },
      }),
    );

    expect(await getTask({ userId: owner.id, orgId: org.id }, taskId)).toMatchObject({
      title: "Write landing copy",
      priority: "high",
      dueDate: "2026-12-01",
      assigneeId: alice.id,
      description,
      createdBy: { id: owner.id, name: "Owner" },
    });
  });

  it("shows on the board whether a task has a description", async () => {
    const { org, owner, board, addTask } = await setup();
    const taskId = await addTask("Write copy");
    const hasDescription = async () =>
      (await board()).tasks.find((t) => t.id === taskId)?.hasDescription;
    expect(await hasDescription()).toBe(false);

    actAs(owner);
    unwrap(
      await updateTaskAction({
        orgId: org.id,
        taskId,
        changes: {
          description: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Notes" }] }],
          },
        },
      }),
    );

    expect(await hasDescription()).toBe(true);
  });

  it("only assigns people on the project", async () => {
    const { org, owner, bob, admin, addTask } = await setup();
    const taskId = await addTask("Write copy");
    actAs(owner);

    expect(
      await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: bob.id } }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
    // Admins see every project, so they can always be assigned.
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: admin.id } }));
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: null } }));
  });

  it("rejects unknown fields and invalid dates", async () => {
    const { org, owner, addTask } = await setup();
    const taskId = await addTask("Write copy");
    actAs(owner);

    for (const changes of [{ projectId: taskId }, { dueDate: "tomorrow" }]) {
      expect(await updateTaskAction({ orgId: org.id, taskId, changes })).toMatchObject({
        ok: false,
        error: { code: "validation_error" },
      });
    }
  });

  it("returns not found for a task in a project the member isn't on", async () => {
    const { org, bob, addTask } = await setup();
    const taskId = await addTask("Secret");
    actAs(bob);

    expect(
      await updateTaskAction({ orgId: org.id, taskId, changes: { title: "Mine" } }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await getTask({ userId: bob.id, orgId: org.id }, taskId)).toBeNull();
  });

  it("lets members delete their own tasks but not other people's", async () => {
    const { org, owner, alice, todo, addTask, titlesIn } = await setup();
    const ownersTask = await addTask("Owner's task");
    const alicesTask = await addTask("Alice's task", todo, alice);

    actAs(alice);
    expect(await deleteTaskAction({ orgId: org.id, taskId: ownersTask })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    unwrap(await deleteTaskAction({ orgId: org.id, taskId: alicesTask }));
    expect(await titlesIn(todo)).toEqual(["Owner's task"]);

    actAs(owner);
    unwrap(await deleteTaskAction({ orgId: org.id, taskId: ownersTask }));
    expect(await titlesIn(todo)).toEqual([]);
  });
});

describe("moveTaskAction", () => {
  it("reorders within a column and moves across columns", async () => {
    const { org, owner, todo, doing, addTask, titlesIn } = await setup();
    const a = await addTask("A");
    const b = await addTask("B");
    const c = await addTask("C");
    actAs(owner);

    unwrap(await moveTaskAction({ orgId: org.id, taskId: c, columnId: todo, afterTaskId: null }));
    expect(await titlesIn(todo)).toEqual(["C", "A", "B"]);

    unwrap(await moveTaskAction({ orgId: org.id, taskId: c, columnId: todo, afterTaskId: a }));
    expect(await titlesIn(todo)).toEqual(["A", "C", "B"]);

    unwrap(await moveTaskAction({ orgId: org.id, taskId: a, columnId: doing, afterTaskId: null }));
    unwrap(await moveTaskAction({ orgId: org.id, taskId: b, columnId: doing, afterTaskId: a }));
    expect(await titlesIn(todo)).toEqual(["C"]);
    expect(await titlesIn(doing)).toEqual(["A", "B"]);
  });

  it("renumbers the column when two tasks ended up with the same position", async () => {
    const { org, owner, todo, addTask, titlesIn } = await setup();
    const a = await addTask("A");
    const b = await addTask("B");
    const c = await addTask("C");
    // Simulate two moves that raced into the same gap.
    const [first] = await db.select().from(tasks).where(eq(tasks.id, a));
    await db.update(tasks).set({ position: first?.position }).where(eq(tasks.id, b));
    // Tied tasks are ordered by id, so either may come first.
    const [lead, trail] = (await titlesIn(todo)).slice(0, 2);
    const leadId = lead === "A" ? a : b;

    actAs(owner);
    unwrap(await moveTaskAction({ orgId: org.id, taskId: c, columnId: todo, afterTaskId: leadId }));

    expect(await titlesIn(todo)).toEqual([lead, "C", trail]);
    const positions = (await db.select().from(tasks).where(eq(tasks.columnId, todo))).map(
      (t) => t.position,
    );
    expect(new Set(positions).size).toBe(3);
  });

  it("puts the task last when the task it should follow is gone", async () => {
    const { org, owner, todo, doing, addTask, titlesIn } = await setup();
    const a = await addTask("A");
    const b = await addTask("B", doing);
    actAs(owner);
    unwrap(await deleteTaskAction({ orgId: org.id, taskId: b }));

    unwrap(await moveTaskAction({ orgId: org.id, taskId: a, columnId: doing, afterTaskId: b }));

    expect(await titlesIn(todo)).toEqual([]);
    expect(await titlesIn(doing)).toEqual(["A"]);
  });

  it("won't move a task into another project's column", async () => {
    const { org, owner, addTask } = await setup();
    const taskId = await addTask("A");
    const other = await projectFor(owner, org.id, "Mobile app");
    const [otherColumn] = (await getBoard({ userId: owner.id, orgId: org.id }, other)).columns;
    actAs(owner);

    expect(
      await moveTaskAction({
        orgId: org.id,
        taskId,
        columnId: otherColumn?.id ?? "",
        afterTaskId: null,
      }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });
});

describe("labels", () => {
  it("creates labels once per name and attaches them to tasks", async () => {
    const { org, owner, alice, board, addTask } = await setup();
    const taskId = await addTask("A");

    actAs(alice);
    const bug = unwrap(await createLabelAction({ orgId: org.id, name: "Bug" }));
    const again = unwrap(await createLabelAction({ orgId: org.id, name: " bug " }));
    const design = unwrap(await createLabelAction({ orgId: org.id, name: "Design" }));
    expect(again).toEqual(bug);
    expect(design.color).not.toBe(bug.color);

    actAs(owner);
    unwrap(await setTaskLabelsAction({ orgId: org.id, taskId, labelIds: [design.id, bug.id] }));
    const task = (await board()).tasks.find((t) => t.id === taskId);
    expect(task?.labels.map((l) => l.name)).toEqual(["Bug", "Design"]);
    expect((await board()).labels.map((l) => l.name)).toEqual(["Bug", "Design"]);

    unwrap(await setTaskLabelsAction({ orgId: org.id, taskId, labelIds: [] }));
    expect((await board()).tasks.find((t) => t.id === taskId)?.labels).toEqual([]);
  });

  it("rejects labels from another organization", async () => {
    const { org, owner, addTask } = await setup();
    const taskId = await addTask("A");
    const other = await team();
    actAs(other.owner);
    const foreign = unwrap(await createLabelAction({ orgId: other.org.id, name: "Bug" }));

    actAs(owner);
    expect(
      await setTaskLabelsAction({ orgId: org.id, taskId, labelIds: [foreign.id] }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });
});

describe("columns", () => {
  it("adds, renames and reorders columns", async () => {
    const { org, owner, projectId, board, todo, doing } = await setup();
    const names = async () => (await board()).columns.map((c) => c.name);
    actAs(owner);

    const blocked = unwrap(await createColumnAction({ orgId: org.id, projectId, name: "Blocked" }));
    unwrap(await renameColumnAction({ orgId: org.id, columnId: todo, name: "Backlog" }));
    expect(await names()).toEqual(["Backlog", "In progress", "Review", "Done", "Blocked"]);

    unwrap(await moveColumnAction({ orgId: org.id, columnId: blocked.id, direction: "left" }));
    expect(await names()).toEqual(["Backlog", "In progress", "Review", "Blocked", "Done"]);

    unwrap(await moveColumnAction({ orgId: org.id, columnId: todo, direction: "right" }));
    unwrap(await moveColumnAction({ orgId: org.id, columnId: doing, direction: "left" }));
    expect(await names()).toEqual(["In progress", "Backlog", "Review", "Blocked", "Done"]);

    // Moving past either end does nothing.
    unwrap(await moveColumnAction({ orgId: org.id, columnId: doing, direction: "left" }));
    expect((await names())[0]).toBe("In progress");
  });

  it("moves a deleted column's tasks to the end of the chosen column", async () => {
    const { org, owner, board, todo, doing, addTask, titlesIn } = await setup();
    await addTask("A");
    await addTask("B");
    await addTask("C", doing);
    actAs(owner);

    expect(
      await deleteColumnAction({ orgId: org.id, columnId: todo, moveTasksTo: null }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
    expect(
      await deleteColumnAction({ orgId: org.id, columnId: todo, moveTasksTo: todo }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });

    unwrap(await deleteColumnAction({ orgId: org.id, columnId: todo, moveTasksTo: doing }));
    expect((await board()).columns.map((c) => c.name)).toEqual(["In progress", "Review", "Done"]);
    expect(await titlesIn(doing)).toEqual(["C", "A", "B"]);
  });

  it("keeps at least one column", async () => {
    const { org, owner, columns } = await setup();
    actAs(owner);
    const [last, ...rest] = columns;
    for (const column of rest) {
      unwrap(await deleteColumnAction({ orgId: org.id, columnId: column.id, moveTasksTo: null }));
    }

    expect(
      await deleteColumnAction({ orgId: org.id, columnId: last?.id ?? "", moveTasksTo: null }),
    ).toMatchObject({ ok: false, error: { code: "validation_error" } });
  });

  it("hides another project's columns from unassigned members", async () => {
    const { org, bob, projectId, todo } = await setup();
    actAs(bob);

    expect(await createColumnAction({ orgId: org.id, projectId, name: "Mine" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(await renameColumnAction({ orgId: org.id, columnId: todo, name: "Mine" })).toMatchObject(
      { ok: false, error: { code: "not_found" } },
    );
  });
});
