"use client";

import { History, KanbanSquare, List } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Board } from "@/server/services/board";

import { BoardContext, useBoard, useBoardContext, type BoardContextValue } from "./board-data";
import { BoardView } from "./board-view";
import { FilterBar, filterTasks, NO_FILTERS, type TaskFilters } from "./filters";
import { ListView } from "./list-view";
import { TaskSheet } from "./task-sheet";

/** The board, list and activity views of a project, with filters and the task sheet. */
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
  const { data: board } = useBoard(initialBoard);
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [view, setView] = useState("board");
  const tasks = filterTasks(board.tasks, filters, userId);

  // The open task lives in the URL (?task=), so notifications and shared links can open it.
  const openTaskId = useSearchParams().get("task");
  function setOpenTaskId(taskId: string | null) {
    const url = new URL(window.location.href);
    if (taskId) url.searchParams.set("task", taskId);
    else url.searchParams.delete("task");
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "activity" ? (
          <h2 className="text-sm font-medium">Activity</h2>
        ) : (
          <FilterBar board={board} filters={filters} onChange={setFilters} />
        )}
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
      <TaskSheet
        taskId={openTaskId}
        board={board}
        onClose={() => {
          setOpenTaskId(null);
        }}
      />
    </Tabs>
  );
}
