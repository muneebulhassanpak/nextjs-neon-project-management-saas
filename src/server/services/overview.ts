import "server-only";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { addDays } from "@/lib/dates";
import type { TaskPriority } from "@/lib/projects";
import { activityLog, projects, tasks, user } from "@/server/db/schema";
import { withOrgContext, type Transaction } from "@/server/db/tenant";

import { doneColumns } from "./done-columns";

import type { Person } from "./projects";
import type { Scope } from "./scope";

/** How far a project has got. Done = in its last column (see doneColumns). */
export interface ProjectProgress {
  total: number;
  done: number;
  overdue: number;
  /** The earliest due date among open tasks from today on, if any. */
  nextDue: string | null;
}

export interface OverviewStats {
  open: number;
  /** Open, due today through the next 6 days. */
  dueThisWeek: number;
  /** Open, due before today. */
  overdue: number;
  /** Moved into their project's done column in the last 7 days, and still there. */
  doneThisWeek: number;
}

export interface DueTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  projectId: string;
  projectName: string;
  assignee: Person | null;
}

export interface Overview {
  stats: OverviewStats;
  /** Overdue and due within a week, soonest first. */
  dueSoon: DueTask[];
}

const DUE_SOON_LIMIT = 6;

interface TaskRow {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  columnId: string;
  assigneeId: string | null;
}

/** Tasks of the given projects, and which of them are done. */
async function tasksWithState(tx: Transaction, projectIds: string[]) {
  if (projectIds.length === 0)
    return {
      rows: [] as TaskRow[],
      done: new Set<string>(),
      doneColumn: new Map<string, { id: string; name: string }>(),
    };
  const [rows, doneColumn] = await Promise.all([
    tx
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
        columnId: tasks.columnId,
        assigneeId: tasks.assigneeId,
      })
      .from(tasks)
      .where(inArray(tasks.projectId, projectIds)),
    doneColumns(tx, projectIds),
  ]);
  const done = new Set(
    rows.filter((row) => doneColumn.get(row.projectId)?.id === row.columnId).map((row) => row.id),
  );
  return { rows, done, doneColumn };
}

/** Progress for each of the given projects (all of them present, even with no tasks). */
export async function projectProgress(
  tx: Transaction,
  projectIds: string[],
  today: string,
): Promise<Map<string, ProjectProgress>> {
  const progress = new Map<string, ProjectProgress>(
    projectIds.map((id) => [id, { total: 0, done: 0, overdue: 0, nextDue: null }]),
  );
  const { rows, done } = await tasksWithState(tx, projectIds);
  for (const row of rows) {
    const entry = progress.get(row.projectId);
    if (!entry) continue;
    entry.total += 1;
    if (done.has(row.id)) {
      entry.done += 1;
      continue;
    }
    if (!row.dueDate) continue;
    if (row.dueDate < today) entry.overdue += 1;
    else if (!entry.nextDue || row.dueDate < entry.nextDue) entry.nextDue = row.dueDate;
  }
  return progress;
}

/**
 * The organization at a glance, over the active projects the user can see (RLS decides):
 * headline counts and what's due soon. `today` is the viewer's date (YYYY-MM-DD).
 */
export async function getOverview(scope: Scope, today: string): Promise<Overview> {
  return withOrgContext(scope, async (tx) => {
    const active = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.orgId, scope.orgId), isNull(projects.archivedAt)));
    const names = new Map(active.map((p) => [p.id, p.name]));
    const { rows, done, doneColumn } = await tasksWithState(tx, [...names.keys()]);

    const weekEnd = addDays(today, 6);
    const open = rows.filter((row) => !done.has(row.id));
    const overdue = open.filter((row) => row.dueDate !== null && row.dueDate < today);
    const dueThisWeek = open.filter(
      (row) => row.dueDate !== null && row.dueDate >= today && row.dueDate <= weekEnd,
    );

    // Done this week: still in the done column, and the move there was logged in the last 7 days.
    const doneIds = [...done];
    let doneThisWeek = 0;
    if (doneIds.length > 0) {
      const moves = await tx
        .selectDistinct({
          taskId: activityLog.taskId,
          projectId: activityLog.projectId,
          to: sql<string>`${activityLog.metadata}->>'to'`,
        })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.action, "task.moved"),
            inArray(activityLog.taskId, doneIds),
            gte(activityLog.createdAt, sql`now() - interval '7 days'`),
          ),
        );
      doneThisWeek = new Set(
        moves
          .filter((move) => move.projectId && doneColumn.get(move.projectId)?.name === move.to)
          .map((move) => move.taskId),
      ).size;
    }

    const soon = [...overdue, ...dueThisWeek]
      .sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.title.localeCompare(b.title),
      )
      .slice(0, DUE_SOON_LIMIT);
    const assigneeIds = [
      ...new Set(soon.flatMap((row) => (row.assigneeId ? [row.assigneeId] : []))),
    ];
    const people =
      assigneeIds.length === 0
        ? []
        : await tx
            .select({ id: user.id, name: user.name, image: user.image })
            .from(user)
            .where(inArray(user.id, assigneeIds));
    const byId = new Map(people.map((person) => [person.id, person]));

    return {
      stats: {
        open: open.length,
        dueThisWeek: dueThisWeek.length,
        overdue: overdue.length,
        doneThisWeek,
      },
      dueSoon: soon.map((row) => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        dueDate: row.dueDate ?? today,
        projectId: row.projectId,
        projectName: names.get(row.projectId) ?? "",
        assignee: row.assigneeId ? (byId.get(row.assigneeId) ?? null) : null,
      })),
    };
  });
}
