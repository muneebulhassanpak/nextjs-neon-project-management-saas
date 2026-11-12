"use client";

import { ArrowRight, Flag, Tag, Trash2, UserRound, X } from "lucide-react";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { PersonAvatar } from "@/components/projects/people";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { byPosition } from "@/lib/positions";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/projects";
import { canDeleteTask } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { bulkChangeTasksAction } from "@/server/actions/board";
import type { Board, BoardTask } from "@/server/services/board";
import type { BulkChange } from "@/server/services/tasks";

import { applyMove, patchTask, useBoardContext, useBoardMutation } from "./board-data";
import { labelDot } from "./label-chip";
import { PriorityIcon } from "./task-meta";

export interface Selection {
  selected: ReadonlySet<string>;
  toggle: (taskId: string) => void;
  /** Selects (or deselects) all of `taskIds`. */
  setMany: (taskIds: string[], on: boolean) => void;
  clear: () => void;
}

const SelectionContext = createContext<Selection | null>(null);
export const SelectionProvider = SelectionContext;

export function useSelection(): Selection {
  const value = use(SelectionContext);
  if (!value) throw new Error("useSelection must be used inside <SelectionProvider>");
  return value;
}

/** Selected task ids. Tasks that leave the board (deleted, filtered out) drop out of it. */
export function useSelectionState(visibleIds: string[]): Selection {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const visibleKey = visibleIds.join(",");
  const selected = useMemo(() => {
    const visible = new Set(visibleKey.split(","));
    return new Set([...chosen].filter((id) => visible.has(id)));
  }, [chosen, visibleKey]);

  const toggle = useCallback((taskId: string) => {
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(taskId)) next.add(taskId);
      return next;
    });
  }, []);
  const setMany = useCallback((taskIds: string[], on: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      for (const id of taskIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setChosen(new Set());
  }, []);

  return useMemo(() => ({ selected, toggle, setMany, clear }), [selected, toggle, setMany, clear]);
}

/** The board after a bulk change, as the server will compute it. */
function applyBulk(board: Board, { taskIds, change }: { taskIds: string[]; change: BulkChange }) {
  const chosen = board.tasks.filter((task) => taskIds.includes(task.id));
  switch (change.kind) {
    case "move": {
      let next = board;
      let afterTaskId =
        board.tasks
          .filter((t) => t.columnId === change.columnId && !taskIds.includes(t.id))
          .sort(byPosition)
          .at(-1)?.id ?? null;
      for (const task of chosen) {
        next = applyMove(next, { taskId: task.id, columnId: change.columnId, afterTaskId });
        afterTaskId = task.id;
      }
      return next;
    }
    case "assign": {
      const assignee = board.people.find((person) => person.id === change.assigneeId) ?? null;
      return chosen.reduce((next, task) => patchTask(next, task.id, { assignee }), board);
    }
    case "priority":
      return chosen.reduce(
        (next, task) => patchTask(next, task.id, { priority: change.priority }),
        board,
      );
    case "label": {
      const label = board.labels.find((l) => l.id === change.labelId);
      if (!label) return board;
      return chosen.reduce(
        (next, task) =>
          task.labels.some((l) => l.id === label.id)
            ? next
            : patchTask(next, task.id, {
                labels: [...task.labels, label].sort((a, b) => a.name.localeCompare(b.name)),
              }),
        board,
      );
    }
    case "delete":
      return board;
  }
}

/** The floating bar for acting on the selected tasks. */
export function BulkBar({
  board,
  onDelete,
}: {
  board: Board;
  onDelete: (tasks: BoardTask[]) => void;
}) {
  const { orgId, userId, role, assigned, canEdit } = useBoardContext();
  const { selected, clear } = useSelection();
  const bulk = useBoardMutation(bulkChangeTasksAction, (current, variables) =>
    applyBulk(current, variables),
  );
  const tasks = board.tasks.filter((task) => selected.has(task.id));
  const count = tasks.length;

  // Escape clears the selection, unless something else (a menu, the task panel) is open.
  useEffect(() => {
    if (count === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role=dialog], [role=menu]")) return;
      clear();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [count, clear]);

  if (count === 0 || !canEdit) return null;
  const deletable = tasks.every((task) => canDeleteTask(role, assigned, task.createdBy === userId));
  const noun = count === 1 ? "task" : "tasks";

  // The board shows the change at once, so no "done" toast (it would bury a delete's Undo), and
  // the selection clears at once: picking the next tasks while this one saves must not be undone.
  function run(change: BulkChange) {
    const taskIds = tasks.map((t) => t.id);
    clear();
    void bulk.run({ orgId, taskIds, change });
  }

  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${count} selected ${noun}`}
      className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-in items-center gap-1 overflow-x-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg duration-200 fade-in slide-in-from-bottom-2"
    >
      <span className="px-2 text-sm font-medium whitespace-nowrap tabular-nums" aria-live="polite">
        {count} selected
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <ArrowRight aria-hidden /> Move
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          {board.columns.map((column) => (
            <DropdownMenuItem
              key={column.id}
              onSelect={() => {
                run({ kind: "move", columnId: column.id });
              }}
            >
              {column.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <UserRound aria-hidden /> Assign
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          <DropdownMenuItem
            onSelect={() => {
              run({ kind: "assign", assigneeId: null });
            }}
          >
            <span className="text-muted-foreground">Unassigned</span>
          </DropdownMenuItem>
          {board.people.map((person) => (
            <DropdownMenuItem
              key={person.id}
              onSelect={() => {
                run({ kind: "assign", assigneeId: person.id });
              }}
            >
              <PersonAvatar person={person} /> {person.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Flag aria-hidden /> Priority
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          {TASK_PRIORITIES.map((priority) => (
            <DropdownMenuItem
              key={priority}
              onSelect={() => {
                run({ kind: "priority", priority });
              }}
            >
              <PriorityIcon priority={priority} /> {TASK_PRIORITY_LABELS[priority]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {board.labels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Tag aria-hidden /> Label
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            {board.labels.map((label) => (
              <DropdownMenuItem
                key={label.id}
                onSelect={() => {
                  run({ kind: "label", labelId: label.id });
                }}
              >
                <span className={cn("size-2 rounded-full", labelDot(label.color))} aria-hidden />
                {label.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={!deletable}
        title={deletable ? undefined : "You can only delete tasks you created."}
        onClick={() => {
          onDelete(tasks);
          clear();
        }}
      >
        <Trash2 aria-hidden /> Delete
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        onClick={clear}
        className="ml-1"
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
