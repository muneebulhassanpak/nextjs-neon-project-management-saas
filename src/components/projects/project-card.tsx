import { CalendarDays, CircleAlert } from "lucide-react";
import Link from "next/link";

import { formatDueDate } from "@/components/board/task-meta";
import type { ProjectStatus } from "@/lib/projects";

import { AvatarStack, type PersonView } from "./people";
import { ProgressMeter } from "./progress-meter";
import { StatusBadge } from "./status-badge";

export interface ProjectCardView {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archived: boolean;
  members: PersonView[];
  progress: { total: number; done: number; overdue: number; nextDue: string | null };
}

export function ProjectCard({ href, project }: { href: string; project: ProjectCardView }) {
  const { progress } = project;
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors outline-none hover:border-foreground/20 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="leading-snug font-medium group-hover:underline group-hover:underline-offset-4">
          {project.name}
        </h2>
        <StatusBadge status={project.status} archived={project.archived} />
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description ?? "No description."}
      </p>
      <div className="mt-auto grid gap-2">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            {progress.total === 0
              ? "No tasks yet"
              : `${progress.done} of ${progress.total} ${progress.total === 1 ? "task" : "tasks"} done`}
          </span>
          {progress.total > 0 && (
            <span className="font-medium text-foreground tabular-nums">
              {Math.round((progress.done / progress.total) * 100)}%
            </span>
          )}
        </div>
        <ProgressMeter
          done={progress.done}
          total={progress.total}
          label={`${project.name} progress`}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {progress.overdue > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
            <CircleAlert className="size-3.5" aria-hidden />
            {progress.overdue} overdue
          </span>
        ) : progress.nextDue ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            Next due {formatDueDate(progress.nextDue)}
          </span>
        ) : (
          <span>Nothing due</span>
        )}
        <AvatarStack people={project.members} />
      </div>
    </Link>
  );
}
