"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use } from "react";
import { toast } from "sonner";

import { byPosition, placeAfter } from "@/lib/positions";
import type { Role } from "@/lib/roles";
import type { ActionResult } from "@/server/errors";
import type { Board, BoardTask } from "@/server/services/board";
import type { TaskDetail } from "@/server/services/tasks";

/** The task detail as it arrives over JSON. */
export type TaskDetailJson = Omit<TaskDetail, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export interface BoardContextValue {
  orgId: string;
  projectId: string;
  userId: string;
  role: Role;
  /** Whether the user is assigned to the project (owners and admins may not be). */
  assigned: boolean;
  /** Whether the user can change tasks and columns (false for archived projects). */
  canEdit: boolean;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoardContext(): BoardContextValue {
  const value = use(BoardContext);
  if (!value) throw new Error("useBoardContext must be used inside <BoardContext>");
  return value;
}

export const boardKey = (projectId: string) => ["board", projectId] as const;
export const taskKey = (taskId: string) => ["task", taskId] as const;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? "Something went wrong. Try again.");
  }
  return (await response.json()) as T;
}

export function useBoard(initialData: Board) {
  const { orgId, projectId } = useBoardContext();
  return useQuery({
    queryKey: boardKey(projectId),
    queryFn: () => getJson<Board>(`/api/orgs/${orgId}/projects/${projectId}/board`),
    initialData,
    staleTime: 15_000,
  });
}

export function useTaskDetail(taskId: string | null) {
  const { orgId } = useBoardContext();
  return useQuery({
    queryKey: taskKey(taskId ?? ""),
    queryFn: () => getJson<TaskDetailJson>(`/api/orgs/${orgId}/tasks/${taskId ?? ""}`),
    enabled: taskId !== null,
  });
}

/**
 * Runs a Server Action that changes the board. `optimistic` updates the cached board right away
 * (synchronously, so a dropped card never jumps back); failures roll it back and show a toast.
 * The board is refetched once the last pending change has finished.
 */
export function useBoardMutation<V, T>(
  action: (variables: V) => Promise<ActionResult<T>>,
  optimistic?: (board: Board, variables: V) => Board,
) {
  const { projectId } = useBoardContext();
  const queryClient = useQueryClient();
  const key = boardKey(projectId);
  const mutationKey = ["board-change", projectId];

  const mutation = useMutation({
    mutationKey,
    mutationFn: async (variables: V) => {
      const result = await action(variables);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: key }),
          queryClient.invalidateQueries({ queryKey: ["activity"] }),
        ]);
      }
    },
  });

  /** Resolves with the result, or `undefined` if it failed (the error is already shown). */
  async function run(variables: V): Promise<T | undefined> {
    let previous: Board | undefined;
    if (optimistic) {
      void queryClient.cancelQueries({ queryKey: key });
      previous = queryClient.getQueryData<Board>(key);
      if (previous) queryClient.setQueryData(key, optimistic(previous, variables));
    }
    try {
      return await mutation.mutateAsync(variables);
    } catch (error) {
      if (previous) queryClient.setQueryData(key, previous);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
      return undefined;
    }
  }

  return { run, pending: mutation.isPending };
}

/** Tasks grouped by column, each column in board order. */
export function tasksByColumn(board: Board, tasks: BoardTask[] = board.tasks) {
  const grouped = new Map<string, BoardTask[]>(board.columns.map((c) => [c.id, []]));
  for (const task of [...tasks].sort(byPosition)) grouped.get(task.columnId)?.push(task);
  return grouped;
}

/** The board after moving a task, as the server will compute it. */
export function applyMove(
  board: Board,
  move: { taskId: string; columnId: string; afterTaskId: string | null },
): Board {
  const siblings = board.tasks.filter((t) => t.columnId === move.columnId);
  const placement = placeAfter(siblings, move.taskId, move.afterTaskId);
  // On a position tie the server renumbers the column; the refetch shows the result.
  if (placement.kind === "rebalance") return board;
  return {
    ...board,
    tasks: board.tasks.map((t) =>
      t.id === move.taskId ? { ...t, columnId: move.columnId, position: placement.position } : t,
    ),
  };
}

/** The board with some fields of one task replaced. */
export function patchTask(board: Board, taskId: string, patch: Partial<BoardTask>): Board {
  return { ...board, tasks: board.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) };
}
