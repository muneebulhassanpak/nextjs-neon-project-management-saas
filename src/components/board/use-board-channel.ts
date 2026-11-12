"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { parseServerMessage, type BoardEvent, type PresenceEntry } from "@realtime/protocol";

import { boardKey, taskKey, useBoardContext } from "./board-data";
import { commentsKey } from "./task-comments";

/** "disabled": live updates aren't set up. "offline": lost the connection, retrying. */
export type ChannelStatus = "disabled" | "connecting" | "live" | "offline";

const PING_INTERVAL_MS = 25_000;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Keeps the board live: joins the board's room on the realtime Worker, refetches what others
 * change and tracks who else is looking. Reconnects with backoff, and refetches the board after
 * a reconnect in case something was missed meanwhile.
 */
export function useBoardChannel(openTaskId: string | null): {
  status: ChannelStatus;
  /** Everyone else on the board, one entry per open tab. */
  viewers: PresenceEntry[];
} {
  const { orgId, projectId, userId } = useBoardContext();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [viewers, setViewers] = useState<PresenceEntry[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const openTask = useRef(openTaskId);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let connectedBefore = false;
    let connecting = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    function onEvent(event: BoardEvent) {
      // This person's own changes are refetched by the tab that made them (and by their other
      // tabs when they're focused).
      if (event.actorId === userId) return;
      const pending = queryClient.isMutating({ mutationKey: ["board-change", projectId] }) > 0;
      // A change of ours in flight refetches the board when it settles; don't undo its
      // optimistic update before then.
      if (!pending) void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
      if ("taskId" in event) {
        const key = event.type === "comment.changed" ? commentsKey : taskKey;
        void queryClient.invalidateQueries({ queryKey: key(event.taskId) });
      }
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    }

    function scheduleRetry() {
      if (disposed) return;
      setStatus("offline");
      const delay = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(() => void connect(), delay * (0.8 + Math.random() * 0.4));
    }

    async function connect() {
      if (connecting) return;
      connecting = true;
      clearTimeout(retry);
      try {
        await open();
      } finally {
        connecting = false;
      }
    }

    async function open() {
      let info: { url: string | null; token: string | null };
      try {
        const response = await fetch(`/api/orgs/${orgId}/projects/${projectId}/realtime`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        info = (await response.json()) as typeof info;
      } catch {
        scheduleRetry();
        return;
      }
      if (disposed) return;
      if (!info.url || !info.token) {
        setStatus("disabled");
        return;
      }

      const ws = new WebSocket(`${info.url}?token=${encodeURIComponent(info.token)}`);
      socket.current = ws;
      ws.addEventListener("open", () => {
        attempt = 0;
        setStatus("live");
        ws.send(JSON.stringify({ type: "viewing", taskId: openTask.current }));
        if (connectedBefore) {
          void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
          void queryClient.invalidateQueries({ queryKey: ["activity"] });
        }
        connectedBefore = true;
        clearInterval(ping);
        ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, PING_INTERVAL_MS);
      });
      ws.addEventListener("message", ({ data }) => {
        if (typeof data !== "string" || data === "pong") return;
        const message = parseServerMessage(data);
        if (message?.type === "event") onEvent(message.event);
        if (message?.type === "presence") {
          setViewers(message.viewers.filter((viewer) => viewer.id !== userId));
        }
      });
      ws.addEventListener("close", () => {
        clearInterval(ping);
        if (socket.current === ws) socket.current = null;
        setViewers([]);
        scheduleRetry();
      });
    }

    // Back online: don't wait out the backoff.
    function onOnline() {
      if (socket.current === null && !disposed) {
        attempt = 0;
        void connect();
      }
    }

    void connect();
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(ping);
      window.removeEventListener("online", onOnline);
      socket.current?.close(1000, "Left the board");
      socket.current = null;
    };
  }, [orgId, projectId, userId, queryClient]);

  useEffect(() => {
    openTask.current = openTaskId;
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: "viewing", taskId: openTaskId }));
    }
  }, [openTaskId]);

  return { status, viewers };
}

/** One entry per person, for avatars. */
export function uniqueViewers(viewers: PresenceEntry[]): PresenceEntry[] {
  const seen = new Map<string, PresenceEntry>();
  for (const viewer of viewers) if (!seen.has(viewer.id)) seen.set(viewer.id, viewer);
  return [...seen.values()];
}
