"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft } from "lucide-react";

import { PersonAvatar } from "@/components/projects/people";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/server/services/board";

import { LabelChip } from "./label-chip";
import { DueDate, PriorityIcon } from "./task-meta";

/** The card's content, shared by the sortable card and the drag preview. */
export function TaskCardBody({ task }: { task: BoardTask }) {
  const hasMeta =
    task.priority !== "none" ||
    task.dueDate !== null ||
    task.hasDescription ||
    task.assignee !== null;
  return (
    <>
      <p className="text-sm leading-snug font-medium break-words">{task.title}</p>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
      {hasMeta && (
        <div className="flex items-center gap-2.5">
          {task.priority !== "none" && <PriorityIcon priority={task.priority} labelled />}
          {task.dueDate && <DueDate date={task.dueDate} />}
          {task.hasDescription && (
            <AlignLeft className="size-3.5 text-muted-foreground" aria-label="Has a description" />
          )}
          {task.assignee && (
            <span className="ml-auto" title={task.assignee.name}>
              <span className="sr-only">Assigned to {task.assignee.name}</span>
              <PersonAvatar person={task.assignee} />
            </span>
          )}
        </div>
      )}
    </>
  );
}

const cardClass =
  "grid gap-2.5 rounded-lg border bg-card p-3 text-left shadow-xs outline-none select-none";

export function TaskCard({
  task,
  onOpen,
  disabled,
}: {
  task: BoardTask;
  onOpen: (taskId: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // Enter opens the task; Space picks it up (see the keyboard sensor in board-view).
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(task.id);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
      onClick={() => {
        onOpen(task.id);
      }}
      role="button"
      tabIndex={0}
      data-task-card
      className={cn(
        cardClass,
        "cursor-pointer transition-colors hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "opacity-40",
      )}
    >
      <TaskCardBody task={task} />
    </div>
  );
}

/** The card that follows the pointer while dragging. */
export function TaskCardPreview({ task }: { task: BoardTask }) {
  return (
    <div
      className={cn(cardClass, "w-72 rotate-2 cursor-grabbing shadow-lg ring-1 ring-primary/30")}
    >
      <TaskCardBody task={task} />
    </div>
  );
}
