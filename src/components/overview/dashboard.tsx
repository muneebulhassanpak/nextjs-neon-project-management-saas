import { CalendarClock, CircleAlert, CircleCheck, ListTodo, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PriorityIcon, formatDueDate } from "@/components/board/task-meta";
import { AvatarStack, PersonAvatar, type PersonView } from "@/components/projects/people";
import { ProgressMeter } from "@/components/projects/progress-meter";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DueTask, OverviewStats, ProjectProgress } from "@/server/services/overview";

/** The four headline numbers. Each is a stat tile: label, value, and what the value covers. */
export function StatTiles({ stats, projectCount }: { stats: OverviewStats; projectCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Open tasks"
        value={stats.open}
        icon={ListTodo}
        note={`Across ${projectCount} active ${projectCount === 1 ? "project" : "projects"}`}
      />
      <StatTile
        label="Due this week"
        value={stats.dueThisWeek}
        icon={CalendarClock}
        note="Today and the next 6 days"
      />
      <StatTile
        label="Overdue"
        value={stats.overdue}
        icon={CircleAlert}
        note={stats.overdue > 0 ? "Past their due date" : "Nothing is late"}
        tone={stats.overdue > 0 ? "critical" : "good"}
      />
      <StatTile
        label="Done this week"
        value={stats.doneThisWeek}
        icon={CircleCheck}
        note="Finished in the last 7 days"
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone?: "good" | "critical";
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription className="flex items-center justify-between gap-2 text-sm">
          {label}
          <Icon
            className={cn(
              "size-4",
              tone === "critical"
                ? "text-red-600 dark:text-red-400"
                : tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
            )}
            aria-hidden
          />
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
          {value.toLocaleString("en-US")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <p
          className={cn(
            "text-xs",
            tone === "critical" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      </CardContent>
    </Card>
  );
}

export interface ProjectRow {
  id: string;
  name: string;
  members: PersonView[];
  progress: ProjectProgress;
}

/** Each active project with how far it has got. */
export function ProjectsProgress({
  projects,
  orgSlug,
}: {
  projects: ProjectRow[];
  orgSlug: string;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>How far each active project has got.</CardDescription>
        <CardAction>
          <Link
            href={`/${orgSlug}/projects`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No active projects yet.</p>
        ) : (
          <ul className="grid gap-5">
            {projects.map(({ id, name, members, progress }) => (
              <li key={id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/${orgSlug}/projects/${id}`}
                    className="min-w-0 truncate text-sm font-medium hover:underline"
                  >
                    {name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {progress.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <CircleAlert className="size-3.5" aria-hidden />
                        {progress.overdue} overdue
                      </span>
                    )}
                    <span className="tabular-nums">
                      {progress.done}/{progress.total} done
                    </span>
                    <AvatarStack people={members} max={3} />
                  </div>
                </div>
                <ProgressMeter
                  done={progress.done}
                  total={progress.total}
                  label={`${name} progress`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Overdue and upcoming open tasks, soonest first. */
export function DueSoon({
  tasks,
  today,
  orgSlug,
}: {
  tasks: DueTask[];
  today: string;
  orgSlug: string;
}) {
  const tomorrow = addDays(today, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Due soon</CardTitle>
        <CardDescription>Late or due in the next 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-sm text-muted-foreground">Nothing due this week.</p>
          </div>
        ) : (
          <ul className="-mx-2 grid">
            {tasks.map((task) => {
              const late = task.dueDate < today;
              const when =
                task.dueDate === today
                  ? "Today"
                  : task.dueDate === tomorrow
                    ? "Tomorrow"
                    : formatDueDate(task.dueDate);
              return (
                <li key={task.id}>
                  <Link
                    href={`/${orgSlug}/projects/${task.projectId}?task=${task.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <PriorityIcon priority={task.priority} />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{task.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {task.projectName}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        late
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {late && <span className="sr-only">Overdue: </span>}
                      {when}
                    </span>
                    {task.assignee ? (
                      <PersonAvatar person={task.assignee} />
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
