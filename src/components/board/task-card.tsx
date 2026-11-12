"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Check, ListChecks } from "lucide-react";

import { PersonAvatar } from "@/components/projects/people";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/server/services/board";

import { useBoardContext } from "./board-data";
import { LabelChip } from "./label-chip";
import { useSelection } from "./selection";
import { DueDate, PriorityIcon } from "./task-meta";

/** The card's content, shared by the sortable card and the drag preview. */
export function TaskCardBody({ task }: { task: BoardTask }) {
  const hasMeta =
    task.priority !== "none" ||
    task.dueDate !== null ||
    task.hasDescription ||
    task.checklist !== null ||
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
          {task.checklist && <ChecklistChip {...task.checklist} />}
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

/** "3/5" checklist progress; green once everything is ticked. */
function ChecklistChip({ done, total }: { done: number; total: number }) {
  const complete = done === total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        complete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      )}
    >
      <ListChecks className="size-3.5" aria-hidden />
      <span className="sr-only">Checklist: </span>
      {done}/{total}
    </span>
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
  const { canEdit } = useBoardContext();
  const { selected, toggle } = useSelection();
  const isSelected = selected.has(task.id);
  const selecting = selected.size > 0;

  return (
    // The wrapper moves with sorting; the checkbox sits beside the card, not inside its button.
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/card relative", isDragging && "opacity-40")}
    >
      <div
        {...attributes}
        {...listeners}
        // Enter opens the task; Space picks it up (see the keyboard sensor in board-view); X
        // selects it.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onOpen(task.id);
            return;
          }
          if (canEdit && event.key === "x" && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            toggle(task.id);
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
        onClick={(event) => {
          // Shift-, Cmd- or Ctrl-click selects instead of opening.
          if (canEdit && (event.shiftKey || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            toggle(task.id);
            return;
          }
          onOpen(task.id);
        }}
        role="button"
        tabIndex={0}
        aria-pressed={selecting ? isSelected : undefined}
        data-task-card
        data-selected={isSelected || undefined}
        className={cn(
          cardClass,
          "cursor-pointer transition-colors hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
          isSelected &&
            "border-primary/60 bg-primary/5 ring-1 ring-primary/40 hover:border-primary/60",
        )}
      >
        <TaskCardBody task={task} />
      </div>
      {canEdit && (
        <button
          type="button"
          aria-label={isSelected ? `Deselect ${task.title}` : `Select ${task.title}`}
          aria-pressed={isSelected}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => {
            toggle(task.id);
          }}
          className={cn(
            "absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-md border bg-background shadow-xs transition-opacity outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
            isSelected
              ? "border-primary bg-primary text-primary-foreground opacity-100"
              : "border-foreground/25 bg-card text-transparent opacity-0 group-hover/card:opacity-100 hover:border-foreground/50",
            selecting && "opacity-100",
          )}
        >
          <Check className="size-3.5" aria-hidden />
        </button>
      )}
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
