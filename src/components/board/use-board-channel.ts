"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

import {
  parseServerMessage,
  type BoardEvent,
  type PresenceEntry,
  type Viewer,
} from "@realtime/protocol";

import { boardKey, taskKey, useBoardContext } from "./board-data";
import { commentsKey } from "./task-comments";

/** "disabled": live updates aren't set up. "offline": lost the connection, retrying. */
export type ChannelStatus = "disabled" | "connecting" | "live" | "offline";

const PING_INTERVAL_MS = 25_000;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
/** How often a typing person tells the room, and how long others show them as typing. */
const TYPING_SEND_MS = 2_000;
const TYPING_SHOW_MS = 5_000;

export interface Typist {
  viewer: Viewer;
  taskId: string;
  /** When to stop showing them, in ms since the epoch. */
  until: number;
}

/** Who's typing where, and how to say that this user is. Provided by the project workspace. */
export interface TypingChannel {
  typing: Typist[];
  sendTyping: (taskId: string) => void;
}

export const TypingContext = createContext<TypingChannel>({
  typing: [],
  sendTyping: () => undefined,
});

export function useTyping(): TypingChannel {
  return use(TypingContext);
}

/**
 * Keeps the board live: joins the board's room on the realtime Worker, refetches what others
 * change and tracks who else is looking. Reconnects with backoff, and refetches the board after
 * a reconnect in case something was missed meanwhile.
 */
export function useBoardChannel(openTaskId: string | null): TypingChannel & {
  status: ChannelStatus;
  /** Everyone else on the board, one entry per open tab. */
  viewers: PresenceEntry[];
} {
  const { orgId, projectId, userId } = useBoardContext();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [viewers, setViewers] = useState<PresenceEntry[]>([]);
  const [typing, setTyping] = useState<Typist[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const openTask = useRef(openTaskId);
  const lastTypingSent = useRef(new Map<string, number>());

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
      // Their comment arrived, so they've stopped typing.
      if (event.type === "comment.changed") {
        setTyping((current) =>
          current.filter((t) => t.viewer.id !== event.actorId || t.taskId !== event.taskId),
        );
      }
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
        if (message?.type === "typing" && message.viewer.id !== userId) {
          const { viewer, taskId } = message;
          setTyping((current) => [
            ...current.filter((t) => t.viewer.id !== viewer.id || t.taskId !== taskId),
            { viewer, taskId, until: Date.now() + TYPING_SHOW_MS },
          ]);
        }
      });
      ws.addEventListener("close", () => {
        clearInterval(ping);
        if (socket.current === ws) socket.current = null;
        setViewers([]);
        setTyping([]);
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

  // Forget typists once their time is up.
  useEffect(() => {
    if (typing.length === 0) return;
    const next = Math.min(...typing.map((t) => t.until));
    const timer = setTimeout(
      () => {
        setTyping((current) => current.filter((t) => t.until > Date.now()));
      },
      Math.max(0, next - Date.now()) + 50,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [typing]);

  const sendTyping = useCallback((taskId: string) => {
    const now = Date.now();
    if (now - (lastTypingSent.current.get(taskId) ?? 0) < TYPING_SEND_MS) return;
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    lastTypingSent.current.set(taskId, now);
    socket.current.send(JSON.stringify({ type: "typing", taskId }));
  }, []);

  return { status, viewers, typing, sendTyping };
}

/** One entry per person, for avatars. */
export function uniqueViewers(viewers: PresenceEntry[]): PresenceEntry[] {
  const seen = new Map<string, PresenceEntry>();
  for (const viewer of viewers) if (!seen.has(viewer.id)) seen.set(viewer.id, viewer);
  return [...seen.values()];
}
