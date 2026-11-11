import {
  CalendarDays,
  CircleAlert,
  Minus,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";

import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/projects";
import { cn } from "@/lib/utils";

const PRIORITY_ICONS = {
  none: Minus,
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
  urgent: CircleAlert,
} satisfies Record<TaskPriority, unknown>;

/** Decorative unless `labelled` (use it where no text label is next to the icon). */
export function PriorityIcon({
  priority,
  labelled = false,
  className,
}: {
  priority: TaskPriority;
  labelled?: boolean;
  className?: string;
}) {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        priority === "urgent" ? "text-orange-500" : "text-muted-foreground",
        className,
      )}
      {...(labelled
        ? { role: "img", "aria-label": `${TASK_PRIORITY_LABELS[priority]} priority` }
        : { "aria-hidden": true })}
    />
  );
}

const dueFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dueFormatWithYear = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** "Dec 1" for a `YYYY-MM-DD` date (with the year when it isn't this year). */
export function formatDueDate(date: string, withYear = false): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const thisYear = new Date().getUTCFullYear() === parsed.getUTCFullYear();
  return (withYear || !thisYear ? dueFormatWithYear : dueFormat).format(parsed);
}

/** Today in the browser's time zone, as `YYYY-MM-DD`. */
export function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function DueDate({ date, className }: { date: string; className?: string }) {
  const overdue = date < today();
  return (
    <span
      // Server and browser may disagree about "today" around midnight.
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <CalendarDays className="size-3.5" aria-hidden />
      <span className="sr-only">{overdue ? "Overdue, due" : "Due"}</span>
      {formatDueDate(date)}
    </span>
  );
}
