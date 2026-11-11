import { ListTodo } from "lucide-react";
import Link from "next/link";

import type { ProjectStatus } from "@/lib/projects";

import { AvatarStack, type PersonView } from "./people";
import { StatusBadge } from "./status-badge";

export interface ProjectCardView {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archived: boolean;
  taskCount: number;
  members: PersonView[];
}

export function ProjectCard({ href, project }: { href: string; project: ProjectCardView }) {
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
      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ListTodo className="size-3.5" aria-hidden />
          {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
        </span>
        <AvatarStack people={project.members} />
      </div>
    </Link>
  );
}
