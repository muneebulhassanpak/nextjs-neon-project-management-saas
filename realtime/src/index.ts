import { DurableObject } from "cloudflare:workers";

import {
  isAuthorized,
  isRoomId,
  parseBoardEvent,
  parseClientMessage,
  verifyToken,
  type BoardEvent,
  type PresenceEntry,
  type ServerMessage,
  type Viewer,
} from "./protocol";

export interface Env {
  BOARD_ROOM: DurableObjectNamespace<BoardRoom>;
  /** Shared with the app: signs connect tokens and authorizes posted events. */
  REALTIME_SECRET: string;
}

/*
 * Routes:
 *   GET  /health                         → "ok"
 *   GET  /rooms/:projectId/connect?token= → WebSocket into that board's room
 *   POST /rooms/:projectId/events        → relay a BoardEvent (Authorization: Bearer <secret>)
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");

    const match = /^\/rooms\/([^/]+)\/(connect|events)$/.exec(url.pathname);
    const room = match?.[1];
    if (!match || !room || !isRoomId(room)) return new Response("Not found", { status: 404 });
    const stub = env.BOARD_ROOM.get(env.BOARD_ROOM.idFromName(room));

    if (match[2] === "events") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (!isAuthorized(request.headers.get("authorization"), env.REALTIME_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const event = parseBoardEvent(await request.json().catch(() => null));
      if (!event) return new Response("Bad event", { status: 400 });
      await stub.broadcast(event);
      return new Response(null, { status: 204 });
    }

    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const claims = await verifyToken(url.searchParams.get("token") ?? "", env.REALTIME_SECRET);
    if (claims?.room !== room) return new Response("Unauthorized", { status: 401 });
    const viewer: Viewer = { id: claims.id, name: claims.name, image: claims.image };
    // The room only needs to know who joined; the token stays here.
    return stub.fetch("https://room/connect", {
      headers: { upgrade: "websocket", "x-viewer": JSON.stringify(viewer) },
    });
  },
} satisfies ExportedHandler<Env>;

/**
 * One room per board. Uses WebSocket hibernation: while nobody sends anything the room is
 * evicted from memory and costs nothing, and each socket's viewer lives in its attachment.
 */
export class BoardRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  override fetch(request: Request): Response {
    const viewer = JSON.parse(request.headers.get("x-viewer") ?? "null") as Viewer | null;
    if (!viewer) return new Response("Missing viewer", { status: 400 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const entry: PresenceEntry = { ...viewer, connectionId: crypto.randomUUID(), taskId: null };
    server.serializeAttachment(entry);
    this.sendPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Called by the Worker for every posted event. */
  broadcast(event: BoardEvent): void {
    this.send({ type: "event", event });
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    const parsed = parseClientMessage(message);
    if (!parsed) return;
    const entry = ws.deserializeAttachment() as PresenceEntry;
    if (parsed.type === "typing") {
      const viewer: Viewer = { id: entry.id, name: entry.name, image: entry.image };
      this.send({ type: "typing", viewer, taskId: parsed.taskId }, ws);
      return;
    }
    if (entry.taskId === parsed.taskId) return;
    ws.serializeAttachment({ ...entry, taskId: parsed.taskId });
    this.sendPresence();
  }

  override webSocketClose(ws: WebSocket): void {
    try {
      ws.close(1000, "Bye");
    } catch {
      // Already closed by the runtime.
    }
    this.sendPresence(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.sendPresence(ws);
  }

  private sendPresence(leaving?: WebSocket): void {
    const viewers = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== leaving)
      .map((ws) => ws.deserializeAttachment() as PresenceEntry);
    this.send({ type: "presence", viewers }, leaving);
  }

  private send(message: ServerMessage, except?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        // Already closing; its close handler updates presence.
      }
    }
  }
}
