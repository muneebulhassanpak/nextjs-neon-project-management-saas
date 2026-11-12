import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { addDays, todayIn } from "@/lib/dates";
import { createTaskAction, moveTaskAction, updateTaskAction } from "@/server/actions/board";
import { setProjectArchivedAction } from "@/server/actions/projects";
import { db } from "@/server/db/client";
import { activityLog } from "@/server/db/schema";
import type { ActionResult } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import { getOverview } from "@/server/services/overview";
import { listProjects } from "@/server/services/projects";

import { actAs } from "./helpers/session";
import { projectFor, team } from "./helpers/teams";

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Action failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

// The activity log's "last 7 days" runs on the database clock, so tests use real dates.
const TODAY = todayIn("UTC");

/**
 * "Website" (Alice is on it): Late (2 days overdue), Now (due today), Soon (in 6 days),
 * Later (in 10 days), Shipped (no date, moved to Done). "Secret" (owner only): Hidden (overdue).
 */
async function setup() {
  const people = await team();
  const { org, owner, alice } = people;
  actAs(owner);
  const website = await projectFor(owner, org.id, "Website", [alice.id]);
  const secret = await projectFor(owner, org.id, "Secret");

  async function add(projectId: string, title: string, due: number | null) {
    const { columns } = await getBoard({ userId: owner.id, orgId: org.id }, projectId);
    const taskId = unwrap(
      await createTaskAction({ orgId: org.id, columnId: columns[0]?.id ?? "", title }),
    ).id;
    if (due !== null) {
      unwrap(
        await updateTaskAction({
          orgId: org.id,
          taskId,
          changes: {
            dueDate: addDays(TODAY, due),
            assigneeId: projectId === website ? alice.id : null,
          },
        }),
      );
    }
    return { taskId, done: columns.at(-1)?.id ?? "" };
  }

  await add(website, "Late", -2);
  await add(website, "Now", 0);
  await add(website, "Soon", 6);
  await add(website, "Later", 10);
  const shipped = await add(website, "Shipped", null);
  unwrap(
    await moveTaskAction({
      orgId: org.id,
      taskId: shipped.taskId,
      columnId: shipped.done,
      afterTaskId: null,
    }),
  );
  await add(secret, "Hidden", -1);
  return { ...people, website, secret, shipped };
}

describe("overview", () => {
  it("counts open, due this week, overdue and done this week", async () => {
    const { org, owner } = await setup();
    const overview = await getOverview({ userId: owner.id, orgId: org.id }, TODAY);

    expect(overview.stats).toEqual({ open: 5, dueThisWeek: 2, overdue: 2, doneThisWeek: 1 });
    expect(overview.dueSoon.map((task) => task.title)).toEqual(["Late", "Hidden", "Now", "Soon"]);
    expect(overview.dueSoon[0]).toMatchObject({
      projectName: "Website",
      dueDate: addDays(TODAY, -2),
      assignee: { name: "Alice" },
    });
  });

  it("only counts projects the person can see, and skips archived ones", async () => {
    const { org, owner, alice, secret } = await setup();
    const alices = await getOverview({ userId: alice.id, orgId: org.id }, TODAY);
    expect(alices.stats).toEqual({ open: 4, dueThisWeek: 2, overdue: 1, doneThisWeek: 1 });
    expect(alices.dueSoon.map((task) => task.title)).not.toContain("Hidden");

    actAs(owner);
    unwrap(await setProjectArchivedAction({ orgId: org.id, projectId: secret, archived: true }));
    const owners = await getOverview({ userId: owner.id, orgId: org.id }, TODAY);
    expect(owners.stats.overdue).toBe(1);
  });

  it("counts a task as done this week only if it was moved there in the last 7 days", async () => {
    const { org, owner, shipped } = await setup();
    await db
      .update(activityLog)
      .set({ createdAt: sql`now() - interval '8 days'` })
      .where(eq(activityLog.taskId, shipped.taskId));
    const overview = await getOverview({ userId: owner.id, orgId: org.id }, TODAY);
    expect(overview.stats.doneThisWeek).toBe(0);
  });

  it("shows each project's progress on the projects list", async () => {
    const { org, owner, alice } = await setup();
    const [website] = (
      await listProjects({ userId: alice.id, orgId: org.id }, { today: TODAY })
    ).filter((p) => p.name === "Website");
    expect(website?.progress).toEqual({ total: 5, done: 1, overdue: 1, nextDue: TODAY });

    const projects = await listProjects({ userId: owner.id, orgId: org.id }, { today: TODAY });
    expect(projects.find((p) => p.name === "Secret")?.progress).toEqual({
      total: 1,
      done: 0,
      overdue: 1,
      nextDue: null,
    });
  });
});
