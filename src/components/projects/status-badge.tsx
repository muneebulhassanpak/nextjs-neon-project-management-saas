import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/projects";
import { cn } from "@/lib/utils";

const DOT: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  completed: "bg-primary",
};

export function StatusBadge({ status, archived }: { status: ProjectStatus; archived?: boolean }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
      <span
        className={cn("size-1.5 rounded-full", archived ? "bg-zinc-400" : DOT[status])}
        aria-hidden
      />
      {archived ? "Archived" : PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
