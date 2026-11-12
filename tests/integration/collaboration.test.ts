import { describe, expect, it } from "vitest";

import { GET as activityRoute } from "@/app/api/orgs/[orgId]/activity/route";
import { GET as notificationsRoute } from "@/app/api/orgs/[orgId]/notifications/route";
import { GET as commentsRoute } from "@/app/api/orgs/[orgId]/tasks/[taskId]/comments/route";
import { describeActivity } from "@/lib/activity";
import { mentionToken } from "@/lib/mentions";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  setTaskLabelsAction,
  updateTaskAction,
  createLabelAction,
} from "@/server/actions/board";
import {
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
  markNotificationsReadAction,
} from "@/server/actions/collaboration";
import { setProjectArchivedAction, setProjectMembersAction } from "@/server/actions/projects";
import type { ActionResult } from "@/server/errors";
import {
  LOG_PAGE_SIZE,
  listActivity,
  listActivityLog,
  type ActivityItem,
} from "@/server/services/activity";
import { getBoard } from "@/server/services/board";
import { listComments } from "@/server/services/comments";
import { listNotifications } from "@/server/services/notifications";

import { request } from "../setup/request-scope";
import { actAs, type SignedInUser } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Action failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

const sentence = (item: ActivityItem) =>
  `${item.actor?.name ?? "Someone"} ${describeActivity(item)
    .map((part) => part.text)
    .join("")}`;

/** A team with a "Website" project Alice is on, and one task in To do. */
async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  const projectId = await projectFor(owner, org.id, "Website", [alice.id]);
  const { columns } = await getBoard({ userId: owner.id, orgId: org.id }, projectId);
  const [todo, doing] = columns.map((c) => c.id);
  if (!todo || !doing) throw new Error("Missing default columns");
  actAs(owner);
  const taskId = unwrap(
    await createTaskAction({ orgId: org.id, columnId: todo, title: "Fix login" }),
  ).id;

  const feed = async (as: SignedInUser, filter: { projectId?: string; taskId?: string } = {}) =>
    (await listActivity({ userId: as.id, orgId: org.id }, filter)).items.map(sentence);
  const inbox = (as: SignedInUser) => listNotifications({ userId: as.id, orgId: org.id });
  return { ...people, projectId, todo, doing, taskId, feed, inbox };
}

describe("activity log", () => {
  it("records task changes as readable sentences, newest first", async () => {
    const { org, owner, alice, doing, taskId, feed } = await setup();
    actAs(owner);

    unwrap(await moveTaskAction({ orgId: org.id, taskId, columnId: doing, afterTaskId: null }));
    unwrap(
      await updateTaskAction({
        orgId: org.id,
        taskId,
        changes: { title: "Fix the login page", priority: "high", dueDate: "2026-12-01" },
      }),
    );
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: alice.id } }));
    const bug = unwrap(await createLabelAction({ orgId: org.id, name: "Bug" }));
    unwrap(await setTaskLabelsAction({ orgId: org.id, taskId, labelIds: [bug.id] }));

    expect(await feed(owner, { taskId })).toEqual([
      "Owner labeled Fix the login page Bug",
      "Owner assigned Fix the login page to Alice",
      "Owner set Fix the login page due Dec 1, 2026",
      "Owner set the priority of Fix the login page to High",
      "Owner renamed Fix login to Fix the login page",
      "Owner moved Fix login from To do to In progress",
      "Owner created Fix login in To do",
    ]);
  });

  it("doesn't log reorders within a column or saves that change nothing", async () => {
    const { org, owner, todo, taskId, feed } = await setup();
    actAs(owner);

    unwrap(await moveTaskAction({ orgId: org.id, taskId, columnId: todo, afterTaskId: null }));
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { priority: "none" } }));
    unwrap(await setTaskLabelsAction({ orgId: org.id, taskId, labelIds: [] }));

    expect(await feed(owner, { taskId })).toEqual(["Owner created Fix login in To do"]);
  });

  it("logs a burst of description edits once", async () => {
    const { org, owner, taskId, feed } = await setup();
    actAs(owner);
    const doc = (text: string) => ({
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });

    for (const text of ["Steps", "Steps to", "Steps to reproduce"]) {
      unwrap(
        await updateTaskAction({ orgId: org.id, taskId, changes: { description: doc(text) } }),
      );
    }

    expect(await feed(owner, { taskId })).toEqual([
      "Owner updated the description of Fix login",
      "Owner created Fix login in To do",
    ]);
  });

  it("keeps a deleted task's history", async () => {
    const { org, owner, taskId, feed, projectId } = await setup();
    actAs(owner);

    unwrap(await deleteTaskAction({ orgId: org.id, taskId }));

    expect(await feed(owner, { projectId })).toEqual([
      "Owner deleted Fix login",
      "Owner created Fix login in To do",
      "Owner created the project Website",
    ]);
  });

  it("records project changes and membership", async () => {
    const { org, owner, bob, projectId, feed } = await setup();
    actAs(owner);

    unwrap(await setProjectMembersAction({ orgId: org.id, projectId, userIds: [bob.id] }));
    unwrap(await setProjectArchivedAction({ orgId: org.id, projectId, archived: true }));
    unwrap(await setProjectArchivedAction({ orgId: org.id, projectId, archived: false }));

    expect((await feed(owner, { projectId })).slice(0, 3)).toEqual([
      "Owner restored Website",
      "Owner archived Website",
      "Owner added Bob to Website and removed Alice",
    ]);
  });

  it("shows members only their projects' activity, and clients none", async () => {
    const { org, owner, alice, bob, client, feed } = await setup();
    await projectFor(owner, org.id, "Secret");

    expect(await feed(owner)).toContain("Owner created the project Secret");
    expect(await feed(alice)).not.toContain("Owner created the project Secret");
    expect(await feed(alice)).toContain("Owner created Fix login in To do");
    expect(await feed(bob)).toEqual([]);
    expect(await feed(client)).toEqual([]);
  });

  it("pages through older entries with a cursor", async () => {
    const { org, owner, todo, projectId } = await setup();
    actAs(owner);
    for (let i = 0; i < 24; i++) {
      unwrap(await createTaskAction({ orgId: org.id, columnId: todo, title: `Task ${i}` }));
    }
    const scope = { userId: owner.id, orgId: org.id };

    const first = await listActivity(scope, { projectId });
    expect(first.items).toHaveLength(20);
    const second = await listActivity(scope, { projectId, cursor: first.nextCursor });
    // 24 tasks + "Fix login" + the project itself.
    expect(second.items).toHaveLength(6);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(26);
  });

  it("numbers pages for the Activity page, per project or across them", async () => {
    const { org, owner, alice, todo, projectId } = await setup();
    await projectFor(owner, org.id, "Secret");
    actAs(owner);
    for (let i = 0; i < 24; i++) {
      unwrap(await createTaskAction({ orgId: org.id, columnId: todo, title: `Task ${i}` }));
    }
    const owners = { userId: owner.id, orgId: org.id };

    // 24 tasks + "Fix login" + the project, and the Secret project across the organization.
    const first = await listActivityLog(owners, { projectId });
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: 26 });
    expect(first.items).toHaveLength(LOG_PAGE_SIZE);
    const second = await listActivityLog(owners, { projectId, page: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.items.map(sentence)).toEqual(["Owner created the project Website"]);
    expect(await listActivityLog(owners)).toMatchObject({ total: 27 });

    // Pages past the end show the last one; members don't count projects they aren't on.
    expect(await listActivityLog(owners, { projectId, page: 9 })).toMatchObject({ page: 2 });
    expect(await listActivityLog({ userId: alice.id, orgId: org.id })).toMatchObject({
      total: 26,
    });
    expect(
      await listActivityLog(
        { userId: alice.id, orgId: org.id },
        { projectId: "00000000-0000-4000-8000-000000000000" },
      ),
    ).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});

describe("comments", () => {
  it("lets anyone on the project comment, and logs it", async () => {
    const { org, alice, taskId, feed } = await setup();
    actAs(alice);

    unwrap(await addCommentAction({ orgId: org.id, taskId, body: "  On it.  " }));

    const list = await listComments({ userId: alice.id, orgId: org.id }, taskId);
    expect(list).toMatchObject([{ body: "On it.", editedAt: null, author: { name: "Alice" } }]);
    expect((await feed(alice, { taskId }))[0]).toBe("Alice commented on Fix login");
  });

  it("hides comments from people who can't see the task", async () => {
    const { org, owner, bob, client, taskId } = await setup();
    actAs(owner);
    unwrap(await addCommentAction({ orgId: org.id, taskId, body: "Private" }));

    for (const outsider of [bob, client]) {
      actAs(outsider);
      expect(await addCommentAction({ orgId: org.id, taskId, body: "Hi" })).toMatchObject({
        ok: false,
      });
      expect(await listComments({ userId: outsider.id, orgId: org.id }, taskId)).toEqual([]);
    }
  });

  it("only lets authors edit, and authors or admins delete", async () => {
    const { org, owner, admin, alice, taskId } = await setup();
    actAs(alice);
    const { id } = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "First" }));

    actAs(owner);
    expect(await editCommentAction({ orgId: org.id, commentId: id, body: "Hacked" })).toMatchObject(
      { ok: false, error: { code: "forbidden" } },
    );
    actAs(alice);
    unwrap(await editCommentAction({ orgId: org.id, commentId: id, body: "First, edited" }));
    const [edited] = await listComments({ userId: alice.id, orgId: org.id }, taskId);
    expect(edited?.body).toBe("First, edited");
    expect(edited?.editedAt).toBeInstanceOf(Date);

    const { id: second } = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "Two" }));
    actAs(admin);
    unwrap(await deleteCommentAction({ orgId: org.id, commentId: id }));
    actAs(owner);
    unwrap(await deleteCommentAction({ orgId: org.id, commentId: second }));
    expect(await listComments({ userId: alice.id, orgId: org.id }, taskId)).toEqual([]);
  });

  it("won't let members delete other people's comments", async () => {
    const { org, owner, alice, taskId } = await setup();
    actAs(owner);
    const { id } = unwrap(await addCommentAction({ orgId: org.id, taskId, body: "Owner's" }));

    actAs(alice);
    expect(await deleteCommentAction({ orgId: org.id, commentId: id })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("rejects empty comments", async () => {
    const { org, owner, taskId } = await setup();
    actAs(owner);

    expect(await addCommentAction({ orgId: org.id, taskId, body: "   " })).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });
});

describe("notifications", () => {
  it("notifies people mentioned in a comment, if they can see the task", async () => {
    const { org, owner, admin, alice, bob, taskId, inbox } = await setup();
    actAs(owner);
    const body = `${mentionToken(alice.id)} and ${mentionToken(bob.id)} and ${mentionToken(admin.id)}, thoughts?`;

    unwrap(await addCommentAction({ orgId: org.id, taskId, body }));

    expect(await inbox(alice)).toMatchObject({
      unread: 1,
      people: { [alice.id]: "Alice", [bob.id]: "Bob", [admin.id]: "Admin" },
      items: [
        {
          type: "mention",
          read: false,
          actor: { name: "Owner" },
          task: { id: taskId, title: "Fix login", projectName: "Website" },
          comment: body,
        },
      ],
    });
    expect((await inbox(admin)).unread).toBe(1);
    // Bob isn't on the project, so the mention doesn't reach him.
    expect((await inbox(bob)).unread).toBe(0);
    expect((await inbox(owner)).unread).toBe(0);
  });

  it("notifies only people newly mentioned when a comment is edited", async () => {
    const { org, owner, admin, alice, taskId, inbox } = await setup();
    actAs(owner);
    const { id } = unwrap(
      await addCommentAction({ orgId: org.id, taskId, body: `Hi ${mentionToken(alice.id)}` }),
    );

    unwrap(
      await editCommentAction({
        orgId: org.id,
        commentId: id,
        body: `Hi ${mentionToken(alice.id)} and ${mentionToken(admin.id)}`,
      }),
    );

    expect((await inbox(alice)).unread).toBe(1);
    expect((await inbox(admin)).unread).toBe(1);
  });

  it("notifies the assignee, but not someone who assigns themselves", async () => {
    const { org, owner, alice, taskId, inbox } = await setup();

    actAs(owner);
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: owner.id } }));
    unwrap(await updateTaskAction({ orgId: org.id, taskId, changes: { assigneeId: alice.id } }));

    expect((await inbox(owner)).unread).toBe(0);
    expect(await inbox(alice)).toMatchObject({
      unread: 1,
      items: [{ type: "assigned", actor: { name: "Owner" }, comment: null }],
    });
  });

  it("marks notifications read, one at a time or all at once", async () => {
    const { org, owner, alice, taskId, inbox } = await setup();
    actAs(owner);
    for (const text of ["one", "two", "three"]) {
      unwrap(
        await addCommentAction({
          orgId: org.id,
          taskId,
          body: `${text} ${mentionToken(alice.id)}`,
        }),
      );
    }
    const [newest] = (await inbox(alice)).items;

    actAs(alice);
    unwrap(await markNotificationsReadAction({ orgId: org.id, ids: [newest?.id ?? ""] }));
    expect((await inbox(alice)).unread).toBe(2);
    // Someone else can't mark Alice's notifications.
    actAs(owner);
    unwrap(await markNotificationsReadAction({ orgId: org.id, ids: "all" }));
    expect((await inbox(alice)).unread).toBe(2);
    actAs(alice);
    unwrap(await markNotificationsReadAction({ orgId: org.id, ids: "all" }));
    expect((await inbox(alice)).unread).toBe(0);
  });

  it("hides notifications once the person is taken off the project", async () => {
    const { org, owner, alice, projectId, taskId, inbox } = await setup();
    actAs(owner);
    unwrap(await addCommentAction({ orgId: org.id, taskId, body: mentionToken(alice.id) }));

    unwrap(await setProjectMembersAction({ orgId: org.id, projectId, userIds: [] }));

    expect(await inbox(alice)).toEqual({ unread: 0, items: [], people: {} });
  });
});

describe("collaboration API routes", () => {
  it("serves comments, activity and notifications to members", async () => {
    const { org, owner, alice, taskId, projectId } = await setup();
    actAs(owner);
    unwrap(await addCommentAction({ orgId: org.id, taskId, body: `Hi ${mentionToken(alice.id)}` }));
    actAs(alice);
    const ctx = <T extends Record<string, string>>(params: T) => ({
      params: Promise.resolve(params),
    });

    const comments = await commentsRoute(
      new Request("http://test"),
      ctx({ orgId: org.id, taskId }),
    );
    expect(comments.status).toBe(200);
    expect(await comments.json()).toMatchObject([{ body: `Hi ${mentionToken(alice.id)}` }]);

    const activity = await activityRoute(
      new Request(`http://test?projectId=${projectId}`),
      ctx({ orgId: org.id }),
    );
    expect(activity.status).toBe(200);
    expect(await activity.json()).toMatchObject({ nextCursor: null });
    const log = await activityRoute(
      new Request(`http://test?projectId=${projectId}&page=1`),
      ctx({ orgId: org.id }),
    );
    expect(await log.json()).toMatchObject({ page: 1, pageCount: 1 });

    const notifications = await notificationsRoute(
      new Request("http://test"),
      ctx({ orgId: org.id }),
    );
    expect(await notifications.json()).toMatchObject({ unread: 1 });
  });

  it("rejects bad filters and unknown tasks, and requires a session", async () => {
    const { org, alice, taskId } = await setup();
    actAs(alice);
    const ctx = <T extends Record<string, string>>(params: T) => ({
      params: Promise.resolve(params),
    });

    expect(
      (await activityRoute(new Request("http://test?cursor=nope"), ctx({ orgId: org.id }))).status,
    ).toBe(422);
    expect(
      (await activityRoute(new Request("http://test?page=0"), ctx({ orgId: org.id }))).status,
    ).toBe(422);
    expect(
      (await commentsRoute(new Request("http://test"), ctx({ orgId: org.id, taskId: "nope" })))
        .status,
    ).toBe(404);
    request.headers = new Headers();
    expect(
      (await commentsRoute(new Request("http://test"), ctx({ orgId: org.id, taskId }))).status,
    ).toBe(401);
    expect(
      (await notificationsRoute(new Request("http://test"), ctx({ orgId: org.id }))).status,
    ).toBe(401);
  });
});
