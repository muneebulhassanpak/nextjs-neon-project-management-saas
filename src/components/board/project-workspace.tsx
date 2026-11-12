"use client";

import { History, KanbanSquare, List } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Board } from "@/server/services/board";

import {
  BoardContext,
  tasksByColumn,
  useBoard,
  useBoardContext,
  type BoardContextValue,
} from "./board-data";
import { BoardView } from "./board-view";
import { useDeferredDelete } from "./deferred-delete";
import { FilterBar, filterTasks, NO_FILTERS, type TaskFilters } from "./filters";
import { ListView } from "./list-view";
import { BoardPresence } from "./presence";
import { BulkBar, SelectionProvider, useSelectionState } from "./selection";
import { TaskDialog } from "./task-dialog";
import { TypingContext, useBoardChannel } from "./use-board-channel";

/** The board, list and activity views of a project, with filters and the task modal. */
export function ProjectWorkspace({
  context,
  initialBoard,
}: {
  context: BoardContextValue;
  initialBoard: Board;
}) {
  return (
    <BoardContext value={context}>
      <Workspace initialBoard={initialBoard} />
    </BoardContext>
  );
}

function Workspace({ initialBoard }: { initialBoard: Board }) {
  const { orgId, projectId, userId } = useBoardContext();
  const { data: fetched } = useBoard(initialBoard);
  const deferred = useDeferredDelete();
  // Tasks waiting out their Undo toast are already gone as far as the board is concerned.
  const board = useMemo(
    () =>
      deferred.hidden.size === 0
        ? fetched
        : { ...fetched, tasks: fetched.tasks.filter((task) => !deferred.hidden.has(task.id)) },
    [fetched, deferred.hidden],
  );
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [view, setView] = useState("board");
  const tasks = filterTasks(board.tasks, filters, userId);
  const selection = useSelectionState(tasks.map((task) => task.id));
  // Previous and Next in the open task follow the board: column by column, top to bottom.
  const order = useMemo(
    () => [...tasksByColumn(board, tasks).values()].flat().map((task) => task.id),
    [board, tasks],
  );

  // The open task lives in the URL (?task=), so notifications and shared links can open it.
  const openTaskId = useSearchParams().get("task");
  function setOpenTaskId(taskId: string | null) {
    const url = new URL(window.location.href);
    if (taskId) url.searchParams.set("task", taskId);
    else url.searchParams.delete("task");
    window.history.replaceState(null, "", url);
  }
  const channel = useBoardChannel(openTaskId);
  const { typing, sendTyping } = channel;
  const typingChannel = useMemo(() => ({ typing, sendTyping }), [typing, sendTyping]);

  return (
    <SelectionProvider value={selection}>
      <TypingContext value={typingChannel}>
        <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {view === "activity" ? (
              <h2 className="text-sm font-medium">Activity</h2>
            ) : (
              <FilterBar board={board} filters={filters} onChange={setFilters} />
            )}
            <div className="flex flex-wrap items-center gap-4">
              <BoardPresence status={channel.status} viewers={channel.viewers} />
              <TabsList>
                <TabsTrigger value="board">
                  <KanbanSquare aria-hidden /> Board
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List aria-hidden /> List
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <History aria-hidden /> Activity
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <TabsContent value="board" className="flex min-h-0 flex-1 flex-col">
            <BoardView board={board} tasks={tasks} onOpenTask={setOpenTaskId} />
          </TabsContent>
          <TabsContent value="list">
            <ListView board={board} tasks={tasks} onOpenTask={setOpenTaskId} />
          </TabsContent>
          <TabsContent value="activity" className="max-w-2xl">
            <ActivityFeed
              orgId={orgId}
              filter={{ projectId }}
              empty="Changes to this project's tasks will show up here."
            />
          </TabsContent>
          <TaskDialog
            taskId={openTaskId}
            board={board}
            order={order}
            onOpen={setOpenTaskId}
            viewers={channel.viewers.filter((viewer) => viewer.taskId === openTaskId)}
            onClose={() => {
              setOpenTaskId(null);
            }}
            onDelete={(task) => {
              setOpenTaskId(null);
              deferred.remove([task]);
            }}
          />
          {view !== "activity" && <BulkBar board={board} onDelete={deferred.remove} />}
        </Tabs>
      </TypingContext>
    </SelectionProvider>
  );
}
