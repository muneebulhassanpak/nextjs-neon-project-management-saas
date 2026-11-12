"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createColumnAction, moveTaskAction } from "@/server/actions/board";
import type { Board, BoardTask } from "@/server/services/board";

import { BoardColumnView } from "./board-column";
import { applyMove, tasksByColumn, useBoardContext, useBoardMutation } from "./board-data";
import { BoardScroller } from "./board-scroller";
import { TaskCardPreview } from "./task-card";

/** Task ids per column id, in display order. */
type Layout = Record<string, string[]>;

function layoutOf(board: Board, tasks: BoardTask[]): Layout {
  const layout: Layout = {};
  for (const [columnId, columnTasks] of tasksByColumn(board, tasks)) {
    layout[columnId] = columnTasks.map((t) => t.id);
  }
  return layout;
}

export function BoardView({
  board,
  tasks,
  onOpenTask,
}: {
  board: Board;
  /** The tasks to show, after filters. */
  tasks: BoardTask[];
  onOpenTask: (taskId: string) => void;
}) {
  const { orgId, canEdit } = useBoardContext();
  // dnd-kit's own ids come from a counter, which differs between server and client renders.
  const dndId = useId();
  const move = useBoardMutation(moveTaskAction, applyMove);
  // While dragging, the layout is kept locally so cards can hop between columns.
  const [dragLayout, setDragLayout] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const layout = dragLayout ?? layoutOf(board, tasks);
  const byId = new Map(board.tasks.map((t) => [t.id, t]));
  const columnName = new Map(board.columns.map((c) => [c.id, c.name]));
  const totals = tasksByColumn(board);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens a task, so only Space picks one up.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  function columnOf(id: string, from: Layout = layout): string | undefined {
    if (id in from) return id;
    return Object.keys(from).find((columnId) => from[columnId]?.includes(id));
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragLayout(layoutOf(board, tasks));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragLayout) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = columnOf(activeKey, dragLayout);
    const to = columnOf(overKey, dragLayout);
    if (!from || !to || from === to) return;

    const target = dragLayout[to] ?? [];
    const overIndex = target.indexOf(overKey);
    const below = over.rect.top + over.rect.height / 2 < (active.rect.current.translated?.top ?? 0);
    const index = overIndex === -1 ? target.length : overIndex + (below ? 1 : 0);
    setDragLayout({
      ...dragLayout,
      [from]: (dragLayout[from] ?? []).filter((id) => id !== activeKey),
      [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const finalLayout = dragLayout;
    setActiveId(null);
    setDragLayout(null);
    if (!over || !finalLayout) return;

    const taskId = String(active.id);
    const columnId = columnOf(taskId, finalLayout);
    if (!columnId) return;
    let ids = finalLayout[columnId] ?? [];
    const overKey = String(over.id);
    if (overKey !== taskId && ids.includes(overKey)) {
      ids = arrayMove(ids, ids.indexOf(taskId), ids.indexOf(overKey));
    }
    const afterTaskId = ids[ids.indexOf(taskId) - 1] ?? null;

    const task = byId.get(taskId);
    const before = layoutOf(board, tasks)[task?.columnId ?? ""] ?? [];
    const unchanged =
      task?.columnId === columnId && (before[before.indexOf(taskId) - 1] ?? null) === afterTaskId;
    if (!unchanged) void move.run({ orgId, taskId, columnId, afterTaskId });
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${byId.get(String(active.id))?.title ?? "task"}.`,
    onDragOver: ({ active, over }) => {
      const column = over ? columnName.get(columnOf(String(over.id)) ?? "") : undefined;
      return column
        ? `${byId.get(String(active.id))?.title ?? "Task"} is over ${column}.`
        : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const column = over ? columnName.get(columnOf(String(over.id)) ?? "") : undefined;
      return `Dropped ${byId.get(String(active.id))?.title ?? "task"}${column ? ` in ${column}` : ""}.`;
    },
    onDragCancel: ({ active }) =>
      `Moving ${byId.get(String(active.id))?.title ?? "task"} was cancelled.`,
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragLayout(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press Enter to open the task. To move it, press Space, use the arrow keys, then press Space again to drop it, or Escape to cancel.",
        },
      }}
    >
      <BoardScroller>
        {board.columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            columns={board.columns}
            tasks={(layout[column.id] ?? []).flatMap((id) => byId.get(id) ?? [])}
            totalTasks={totals.get(column.id)?.length ?? 0}
            onOpenTask={onOpenTask}
            dragDisabled={!canEdit}
          />
        ))}
        {canEdit && <AddColumn />}
      </BoardScroller>
      {/* The overlay lingers while it animates into place; it mustn't catch the next press. */}
      <DragOverlay dropAnimation={{ duration: 150 }} className="pointer-events-none">
        {active ? <TaskCardPreview task={active} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function AddColumn() {
  const { orgId, projectId } = useBoardContext();
  const [adding, setAdding] = useState(false);
  const create = useBoardMutation(createColumnAction);

  if (!adding) {
    return (
      <Button
        variant="ghost"
        className="w-72 shrink-0 justify-start text-muted-foreground"
        onClick={() => {
          setAdding(true);
        }}
      >
        <Plus aria-hidden /> Add column
      </Button>
    );
  }
  return (
    <form
      className="w-72 shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        const name = new FormData(event.currentTarget).get("name");
        if (typeof name === "string" && name.trim()) {
          void create.run({ orgId, projectId, name: name.trim() });
        }
        setAdding(false);
      }}
    >
      <Input
        autoFocus
        name="name"
        maxLength={40}
        placeholder="Column name"
        aria-label="New column name"
        onBlur={(event) => {
          if (!event.currentTarget.value.trim()) setAdding(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setAdding(false);
        }}
      />
    </form>
  );
}
