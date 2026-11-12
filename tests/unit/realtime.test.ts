import { describe, expect, it, vi } from "vitest";

import { connectInfo, sendBoardEvent } from "@/server/realtime";
import {
  isAuthorized,
  isRoomId,
  parseBoardEvent,
  parseClientMessage,
  parseServerMessage,
  signToken,
  verifyToken,
  type TokenClaims,
} from "@realtime/protocol";

const SECRET = "unit-test-realtime-secret-000000000000";
const ROOM = "c137b0f0-54e1-49a1-ac01-2bee19c145aa";
const TASK = "6259767d-e2db-4d3b-814f-e6a948bbe72d";
const NOW = Date.UTC(2026, 10, 12, 12);

const claims: TokenClaims = {
  id: "user-1",
  name: "Ada Lovelace",
  image: null,
  room: ROOM,
  exp: NOW / 1000 + 60,
};

describe("connect tokens", () => {
  it("round-trip while valid", async () => {
    const token = await signToken(claims, SECRET);
    expect(await verifyToken(token, SECRET, NOW)).toEqual(claims);
  });

  it("keep non-ASCII names intact", async () => {
    const token = await signToken({ ...claims, name: "Zoë Ångström 🚀" }, SECRET);
    expect((await verifyToken(token, SECRET, NOW))?.name).toBe("Zoë Ångström 🚀");
  });

  it("are rejected once expired", async () => {
    const token = await signToken(claims, SECRET);
    expect(await verifyToken(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("are rejected when signed with another secret or tampered with", async () => {
    const token = await signToken(claims, SECRET);
    expect(await verifyToken(token, `${SECRET}-other`, NOW)).toBeNull();

    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, id: "user-2" })).toString("base64url");
    expect(await verifyToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("are rejected when malformed", async () => {
    for (const token of ["", "abc", "a.b.c", ".", "x.y"]) {
      expect(await verifyToken(token, SECRET, NOW)).toBeNull();
    }
    const signed = await signToken({ ...claims, room: 42 } as unknown as TokenClaims, SECRET);
    expect(await verifyToken(signed, SECRET, NOW)).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorized(SECRET, SECRET)).toBe(false);
    expect(isAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorized(null, SECRET)).toBe(false);
  });
});

describe("message parsing", () => {
  it("accepts board events and drops anything else", () => {
    expect(parseBoardEvent({ type: "task.moved", taskId: TASK, actorId: "u" })).toEqual({
      type: "task.moved",
      taskId: TASK,
      actorId: "u",
    });
    expect(parseBoardEvent({ type: "column.changed", actorId: "u", extra: 1 })).toEqual({
      type: "column.changed",
      actorId: "u",
    });
    expect(parseBoardEvent({ type: "task.moved", taskId: "nope", actorId: "u" })).toBeNull();
    expect(parseBoardEvent({ type: "task.exploded", taskId: TASK, actorId: "u" })).toBeNull();
    expect(parseBoardEvent({ type: "column.changed" })).toBeNull();
    expect(parseBoardEvent(null)).toBeNull();
  });

  it("accepts what browsers may send, within the size limit", () => {
    expect(parseClientMessage(JSON.stringify({ type: "viewing", taskId: TASK }))).toEqual({
      type: "viewing",
      taskId: TASK,
    });
    expect(parseClientMessage('{"type":"viewing","taskId":null}')).toEqual({
      type: "viewing",
      taskId: null,
    });
    expect(parseClientMessage('{"type":"viewing","taskId":"x"}')).toBeNull();
    expect(parseClientMessage('{"type":"shout"}')).toBeNull();
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(`{"type":"viewing","taskId":null,"pad":"${"x".repeat(600)}"}`)).toBe(
      null,
    );
  });

  it("reads what the room sends", () => {
    const viewer = { id: "u", name: "Ada", image: null, connectionId: "c", taskId: null };
    expect(parseServerMessage(JSON.stringify({ type: "presence", viewers: [viewer, {}] }))).toEqual(
      { type: "presence", viewers: [viewer] },
    );
    const event = { type: "task.created", taskId: TASK, actorId: "u" };
    expect(parseServerMessage(JSON.stringify({ type: "event", event }))).toEqual({
      type: "event",
      event,
    });
    expect(parseServerMessage(JSON.stringify({ type: "event", event: {} }))).toBeNull();
    expect(parseServerMessage("pong")).toBeNull();
    expect(parseServerMessage("[]")).toBeNull();
  });

  it("knows a room id when it sees one", () => {
    expect(isRoomId(ROOM)).toBe(true);
    expect(isRoomId("../admin")).toBe(false);
  });
});

describe("connectInfo", () => {
  it("points the browser at the room over ws, or wss for https", async () => {
    const viewer = { id: "user-1", name: "Ada", image: null };
    const local = await connectInfo({ url: "http://localhost:8787", secret: SECRET }, viewer, ROOM);
    expect(local.url).toBe(`ws://localhost:8787/rooms/${ROOM}/connect`);

    const live = await connectInfo(
      { url: "https://rt.example.workers.dev", secret: SECRET },
      viewer,
      ROOM,
      NOW,
    );
    expect(live.url).toBe(`wss://rt.example.workers.dev/rooms/${ROOM}/connect`);
    expect(await verifyToken(live.token, SECRET, NOW)).toEqual({
      ...viewer,
      room: ROOM,
      exp: NOW / 1000 + 60,
    });
  });
});

describe("sendBoardEvent", () => {
  const config = { url: "https://rt.example.workers.dev", secret: SECRET };
  const event = { type: "task.created", taskId: TASK, actorId: "u" } as const;

  it("posts the event to the room with the secret", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await sendBoardEvent(config, ROOM, event, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      `https://rt.example.workers.dev/rooms/${ROOM}/events`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: `Bearer ${SECRET}` }) as unknown,
        body: JSON.stringify(event),
      }),
    );
  });

  it("never throws: a rejected or failed post is only logged", async () => {
    const rejected = vi.fn(() => Promise.resolve(new Response("no", { status: 401 })));
    await expect(sendBoardEvent(config, ROOM, event, rejected)).resolves.toBeUndefined();

    const offline = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    await expect(sendBoardEvent(config, ROOM, event, offline)).resolves.toBeUndefined();
  });
});
