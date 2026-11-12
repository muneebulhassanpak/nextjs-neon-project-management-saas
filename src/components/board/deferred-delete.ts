"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { bulkChangeTasksAction, deleteTaskAction } from "@/server/actions/board";

import { boardKey, useBoardContext } from "./board-data";

/** How long "Undo" is offered before the delete is sent. */
export const UNDO_MS = 5_000;

/**
 * Deletes tasks with an Undo toast. The tasks disappear at once but the delete is only sent when
 * the toast ends, so Undo just shows them again. Leaving the board sends pending deletes right
 * away; closing the tab before then keeps the tasks (nothing is lost by accident).
 */
export function useDeferredDelete(): {
  /** Tasks waiting to be deleted: hide them. */
  hidden: ReadonlySet<string>;
  remove: (tasks: { id: string; title: string }[]) => void;
} {
  const { orgId, projectId } = useBoardContext();
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(new Set<(undo: boolean) => void>());

  const show = useCallback((ids: string[]) => {
    setHidden((current) => new Set([...current].filter((id) => !ids.includes(id))));
  }, []);

  const send = useCallback(
    async (ids: string[]) => {
      const [only] = ids;
      const result =
        ids.length === 1 && only
          ? await deleteTaskAction({ orgId, taskId: only })
          : await bulkChangeTasksAction({ orgId, taskIds: ids, change: { kind: "delete" } });
      if (!result.ok) toast.error(result.error.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKey(projectId) }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      show(ids);
    },
    [orgId, projectId, queryClient, show],
  );

  const remove = useCallback(
    (tasks: { id: string; title: string }[]) => {
      if (tasks.length === 0) return;
      const ids = tasks.map((task) => task.id);
      setHidden((current) => new Set([...current, ...ids]));

      let settled = false;
      const finish = (undo: boolean) => {
        if (settled) return;
        settled = true;
        pending.current.delete(finish);
        if (undo) show(ids);
        else void send(ids);
      };
      pending.current.add(finish);

      const [first] = tasks;
      toast(
        tasks.length === 1 && first ? `Deleted “${first.title}”` : `Deleted ${tasks.length} tasks`,
        {
          duration: UNDO_MS,
          action: {
            label: "Undo",
            onClick: () => {
              finish(true);
            },
          },
          onAutoClose: () => {
            finish(false);
          },
          onDismiss: () => {
            finish(false);
          },
        },
      );
    },
    [send, show],
  );

  // Leaving the board: send what's pending now rather than never.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const finish of [...waiting]) finish(false);
    };
  }, []);

  return { hidden, remove };
}
