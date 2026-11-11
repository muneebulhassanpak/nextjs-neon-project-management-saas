"use client";

import { PersonAvatar } from "@/components/projects/people";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TASK_PRIORITY_LABELS } from "@/lib/projects";
import type { Board, BoardTask } from "@/server/services/board";

import { tasksByColumn } from "./board-data";
import { LabelChip } from "./label-chip";
import { DueDate, PriorityIcon } from "./task-meta";

/** Every task in a table, grouped by column. An accessible alternative to dragging cards. */
export function ListView({
  board,
  tasks,
  onOpenTask,
}: {
  board: Board;
  tasks: BoardTask[];
  onOpenTask: (taskId: string) => void;
}) {
  const grouped = tasksByColumn(board, tasks);
  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        No tasks to show.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[45%]">Task</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Labels</TableHead>
          </TableRow>
        </TableHeader>
        {board.columns.map((column) => {
          const columnTasks = grouped.get(column.id) ?? [];
          if (columnTasks.length === 0) return null;
          return (
            <TableBody key={column.id}>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableCell colSpan={5} className="py-1.5 text-xs font-medium text-muted-foreground">
                  {column.name} <span className="tabular-nums">· {columnTasks.length}</span>
                </TableCell>
              </TableRow>
              {columnTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-0">
                    <button
                      type="button"
                      className="block w-full truncate text-left font-medium outline-none hover:underline focus-visible:underline"
                      onClick={() => {
                        onOpenTask(task.id);
                      }}
                    >
                      {task.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <PriorityIcon priority={task.priority} />
                      <span className="text-xs">{TASK_PRIORITY_LABELS[task.priority]}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <span className="inline-flex items-center gap-2 text-sm">
                        <PersonAvatar person={task.assignee} />
                        <span className="truncate">{task.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <DueDate date={task.dueDate} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((label) => (
                        <LabelChip key={label.id} label={label} />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          );
        })}
      </Table>
    </div>
  );
}
