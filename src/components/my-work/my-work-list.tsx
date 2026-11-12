"use client";

import { CircleCheck, Inbox, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { DueDate, PriorityIcon, today as localToday } from "@/components/board/task-meta";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { groupMyWork, type MyWorkTask } from "@/lib/my-work";
import { cn } from "@/lib/utils";

/** The date only changes at midnight; the next render picks it up. */
const noSubscription = () => () => undefined;

/**
 * The user's tasks across projects, grouped by when they're due. Grouped first with the server's
 * date (so server and browser render the same), then with the browser's own.
 */
export function MyWorkList({
  tasks,
  serverToday,
  orgSlug,
}: {
  tasks: MyWorkTask[];
  serverToday: string;
  orgSlug: string;
}) {
  const today = useSyncExternalStore(noSubscription, localToday, () => serverToday);
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((task) => !task.done);
  const doneCount = tasks.length - open.length;
  const groups = groupMyWork(showDone ? tasks : open, today);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {open.length === 0
            ? "Nothing open."
            : `${open.length} open ${open.length === 1 ? "task" : "tasks"}`}
        </p>
        {doneCount > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-done"
              checked={showDone}
              onCheckedChange={(checked) => {
                setShowDone(checked === true);
              }}
            />
            <Label htmlFor="show-done" className="text-sm font-normal">
              Show done ({doneCount})
            </Label>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {tasks.length === 0 ? (
              <Inbox className="size-5" aria-hidden />
            ) : (
              <CircleCheck className="size-5" aria-hidden />
            )}
          </div>
          <div className="grid gap-1">
            <p className="font-medium">
              {tasks.length === 0 ? "Nothing assigned to you" : "All caught up"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {tasks.length === 0
                ? "Tasks assigned to you in any project will show up here."
                : "Everything assigned to you is done."}
            </p>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`} className="grid gap-2">
            <h2
              id={`group-${group.id}`}
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                group.id === "overdue" && "text-destructive",
              )}
            >
              {group.label}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {group.tasks.length}
              </span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {group.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/${orgSlug}/projects/${task.projectId}?task=${task.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <PriorityIcon priority={task.priority} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-medium",
                        task.done && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </span>
                    {task.checklist && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <ListChecks className="size-3.5" aria-hidden />
                        <span className="sr-only">Checklist: </span>
                        {task.checklist.done}/{task.checklist.total}
                      </span>
                    )}
                    {task.dueDate && !task.done && <DueDate date={task.dueDate} />}
                    <span className="max-w-48 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {task.projectName} · {task.columnName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
