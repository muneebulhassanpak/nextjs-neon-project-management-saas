"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createTaskAction,
  deleteColumnAction,
  moveColumnAction,
  renameColumnAction,
} from "@/server/actions/board";
import type { Board, BoardColumn, BoardTask } from "@/server/services/board";

import { useBoardContext, useBoardMutation } from "./board-data";
import { TaskCard } from "./task-card";

export function BoardColumnView({
  column,
  columns,
  tasks,
  totalTasks,
  onOpenTask,
  dragDisabled,
}: {
  column: BoardColumn;
  columns: BoardColumn[];
  /** The tasks shown (after filters). */
  tasks: BoardTask[];
  /** All tasks in the column, ignoring filters. */
  totalTasks: number;
  onOpenTask: (taskId: string) => void;
  dragDisabled: boolean;
}) {
  const { canEdit } = useBoardContext();
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const index = columns.findIndex((c) => c.id === column.id);
  const headingId = `column-${column.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-muted/50 dark:bg-muted/30"
    >
      <header className="flex h-11 items-center gap-2 pr-1.5 pl-3">
        {renaming ? (
          <RenameColumn
            column={column}
            onDone={() => {
              setRenaming(false);
            }}
          />
        ) : (
          <>
            <h2 id={headingId} className="truncate text-sm font-medium">
              {column.name}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {tasks.length === totalTasks ? totalTasks : `${tasks.length} of ${totalTasks}`}
            </span>
          </>
        )}
        {canEdit && !renaming && (
          <ColumnMenu
            column={column}
            isFirst={index === 0}
            isLast={index === columns.length - 1}
            onRename={() => {
              setRenaming(true);
            }}
            onDelete={() => {
              setDeleting(true);
            }}
          />
        )}
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "mx-1.5 flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-0.5 pb-2 transition-colors",
            isOver && "bg-primary/5",
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} disabled={dragDisabled} />
          ))}
          {tasks.length === 0 && !canEdit && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>
          )}
        </div>
      </SortableContext>

      {canEdit && <AddTask columnId={column.id} />}

      {deleting && (
        <DeleteColumnDialog
          column={column}
          columns={columns}
          taskCount={totalTasks}
          onClose={() => {
            setDeleting(false);
          }}
        />
      )}
    </section>
  );
}

function ColumnMenu({
  column,
  isFirst,
  isLast,
  onRename,
  onDelete,
}: {
  column: BoardColumn;
  isFirst: boolean;
  isLast: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { orgId } = useBoardContext();
  const move = useBoardMutation(moveColumnAction, (board, { direction }) =>
    reorderColumn(board, column.id, direction),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground">
          <MoreHorizontal aria-hidden />
          <span className="sr-only">{column.name} column options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil aria-hidden /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isFirst}
          onSelect={() => void move.run({ orgId, columnId: column.id, direction: "left" })}
        >
          <ArrowLeft aria-hidden /> Move left
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLast}
          onSelect={() => void move.run({ orgId, columnId: column.id, direction: "right" })}
        >
          <ArrowRight aria-hidden /> Move right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isFirst && isLast} onSelect={onDelete}>
          <Trash2 aria-hidden /> Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Swaps a column with its neighbour, so the menu's move shows instantly. */
function reorderColumn(board: Board, columnId: string, direction: "left" | "right"): Board {
  const columns = [...board.columns];
  const index = columns.findIndex((c) => c.id === columnId);
  const target = direction === "left" ? index - 1 : index + 1;
  const a = columns[index];
  const b = columns[target];
  if (!a || !b) return board;
  columns[index] = { ...b, position: a.position };
  columns[target] = { ...a, position: b.position };
  return { ...board, columns };
}

function RenameColumn({ column, onDone }: { column: BoardColumn; onDone: () => void }) {
  const { orgId } = useBoardContext();
  const rename = useBoardMutation(renameColumnAction, (board, { name }) => ({
    ...board,
    columns: board.columns.map((c) => (c.id === column.id ? { ...c, name } : c)),
  }));

  function save(value: string) {
    const name = value.trim();
    onDone();
    if (name && name !== column.name) void rename.run({ orgId, columnId: column.id, name });
  }

  return (
    <Input
      autoFocus
      defaultValue={column.name}
      maxLength={40}
      aria-label="Column name"
      className="h-7 px-2 text-sm font-medium"
      onFocus={(event) => {
        event.currentTarget.select();
      }}
      onBlur={(event) => {
        save(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") save(event.currentTarget.value);
        if (event.key === "Escape") onDone();
      }}
    />
  );
}

function AddTask({ columnId }: { columnId: string }) {
  const { orgId } = useBoardContext();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const create = useBoardMutation(createTaskAction);

  async function submit() {
    const value = title.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    setTitle("");
    await create.run({ orgId, columnId, title: value });
  }

  if (!adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="m-1.5 mt-0 justify-start text-muted-foreground"
        onClick={() => {
          setAdding(true);
        }}
      >
        <Plus aria-hidden /> Add task
      </Button>
    );
  }

  return (
    <form
      className="m-1.5 mt-0 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        autoFocus
        value={title}
        maxLength={200}
        placeholder="Task title"
        aria-label="New task title"
        className="bg-background"
        onChange={(event) => {
          setTitle(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setTitle("");
            setAdding(false);
          }
        }}
        onBlur={() => {
          if (!title.trim()) setAdding(false);
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.pending}>
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setTitle("");
            setAdding(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteColumnDialog({
  column,
  columns,
  taskCount,
  onClose,
}: {
  column: BoardColumn;
  columns: BoardColumn[];
  taskCount: number;
  onClose: () => void;
}) {
  const { orgId } = useBoardContext();
  const others = columns.filter((c) => c.id !== column.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const remove = useBoardMutation(deleteColumnAction, (board, { moveTasksTo }) => ({
    ...board,
    columns: board.columns.filter((c) => c.id !== column.id),
    tasks: board.tasks.map((t) =>
      t.columnId === column.id && moveTasksTo ? { ...t, columnId: moveTasksTo, position: "~" } : t,
    ),
  }));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{column.name}”?</DialogTitle>
          <DialogDescription>
            {taskCount === 0
              ? "The column is empty, so nothing else changes."
              : `Its ${taskCount === 1 ? "task" : `${taskCount} tasks`} will move to the end of another column.`}
          </DialogDescription>
        </DialogHeader>
        {taskCount > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="move-tasks-to">Move tasks to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="move-tasks-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onClose();
              void remove.run({
                orgId,
                columnId: column.id,
                moveTasksTo: taskCount > 0 ? target : null,
              });
            }}
          >
            Delete column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
