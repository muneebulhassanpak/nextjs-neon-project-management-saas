import type { TaskPriority } from "./projects";

export interface MyWorkTask {
  id: string;
  title: string;
  priority: TaskPriority;
  /** `YYYY-MM-DD`, or null. */
  dueDate: string | null;
  projectId: string;
  projectName: string;
  columnName: string;
  /** In the board's rightmost column, which counts as done. */
  done: boolean;
  checklist: { done: number; total: number } | null;
}

export type MyWorkGroupId = "overdue" | "today" | "week" | "later" | "none" | "done";

export const MY_WORK_GROUPS: { id: MyWorkGroupId; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "later", label: "Later" },
  { id: "none", label: "No due date" },
  { id: "done", label: "Done" },
];

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/** Adds days to a `YYYY-MM-DD` date. */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function groupOf(task: MyWorkTask, today: string): MyWorkGroupId {
  if (task.done) return "done";
  if (!task.dueDate) return "none";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= addDays(today, 7)) return "week";
  return "later";
}

/**
 * Tasks grouped by when they're due, `today` being the viewer's local date. Within a group:
 * earliest due first, then most urgent, then by title. Empty groups are left out.
 */
export function groupMyWork(
  tasks: MyWorkTask[],
  today: string,
): { id: MyWorkGroupId; label: string; tasks: MyWorkTask[] }[] {
  const sorted = [...tasks].sort(
    (a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.title.localeCompare(b.title),
  );
  return MY_WORK_GROUPS.map((group) => ({
    ...group,
    tasks: sorted.filter((task) => groupOf(task, today) === group.id),
  })).filter((group) => group.tasks.length > 0);
}
