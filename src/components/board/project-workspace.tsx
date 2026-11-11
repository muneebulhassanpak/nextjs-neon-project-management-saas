"use client";

import { KanbanSquare, List } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Board } from "@/server/services/board";

import { BoardContext, useBoard, useBoardContext, type BoardContextValue } from "./board-data";
import { BoardView } from "./board-view";
import { FilterBar, filterTasks, NO_FILTERS, type TaskFilters } from "./filters";
import { ListView } from "./list-view";
import { QueryProvider } from "./query-provider";
import { TaskSheet } from "./task-sheet";

/** The board and list views of a project, with filters and the task sheet. */
export function ProjectWorkspace({
  context,
  initialBoard,
}: {
  context: BoardContextValue;
  initialBoard: Board;
}) {
  return (
    <QueryProvider>
      <BoardContext value={context}>
        <Workspace initialBoard={initialBoard} />
      </BoardContext>
    </QueryProvider>
  );
}

function Workspace({ initialBoard }: { initialBoard: Board }) {
  const { userId } = useBoardContext();
  const { data: board } = useBoard(initialBoard);
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const tasks = filterTasks(board.tasks, filters, userId);

  return (
    <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar board={board} filters={filters} onChange={setFilters} />
        <TabsList>
          <TabsTrigger value="board">
            <KanbanSquare aria-hidden /> Board
          </TabsTrigger>
          <TabsTrigger value="list">
            <List aria-hidden /> List
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="board" className="flex min-h-0 flex-1 flex-col">
        <BoardView board={board} tasks={tasks} onOpenTask={setOpenTaskId} />
      </TabsContent>
      <TabsContent value="list">
        <ListView board={board} tasks={tasks} onOpenTask={setOpenTaskId} />
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
