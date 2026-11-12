/*
 * What the app and the realtime Worker say to each other. Shared by both sides, so it only uses
 * Web APIs (Web Crypto, TextEncoder) that exist in Node.js and in Cloudflare Workers.
 *
 * - The app signs a short-lived token that lets one person join one board's room.
 * - After a change, the app posts a BoardEvent to the room, which relays it to everyone there.
 *   Events are hints ("this task changed"), never data: browsers refetch from the app, so the
 *   database stays the only source of truth and the Worker never sees task contents.
 */

/** How long a connect token is valid. It's only checked when the WebSocket opens. */
export const TOKEN_TTL_SECONDS = 60;

/** Largest message a browser may send. Real ones are well under 100 bytes. */
const MAX_CLIENT_MESSAGE = 512;

export interface Viewer {
  id: string;
  name: string;
  image: string | null;
}

export interface TokenClaims extends Viewer {
  /** The board's room: its project id. */
  room: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

export type BoardEvent =
  | {
      type: "task.created" | "task.updated" | "task.moved" | "task.deleted";
      taskId: string;
      actorId: string;
    }
  | { type: "comment.changed"; taskId: string; actorId: string }
  | { type: "column.changed"; actorId: string }
  /** Several tasks changed at once (bulk actions). */
  | { type: "board.changed"; actorId: string };

export interface PresenceEntry extends Viewer {
  /** One per open tab, so the same person can appear twice. */
  connectionId: string;
  /** The task this tab has open, if any. */
  taskId: string | null;
}

/** Room → browser. */
export type ServerMessage =
  | { type: "event"; event: BoardEvent }
  | { type: "presence"; viewers: PresenceEntry[] }
  /** Someone is writing a comment on a task. Sent to everyone but them. */
  | { type: "typing"; viewer: Viewer; taskId: string };

/** Browser → room. (Keep-alive pings are the plain string "ping", answered with "pong".) */
export type ClientMessage =
  | { type: "viewing"; taskId: string | null }
  /** Sent at most every few seconds while typing a comment. */
  | { type: "typing"; taskId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRoomId(value: string): boolean {
  return UUID.test(value);
}

// Tokens: base64url(JSON claims) + "." + base64url(HMAC-SHA256 of that part).

export async function signToken(claims: TokenClaims, secret: string): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  return `${payload}.${toBase64Url(await hmac(payload, secret))}`;
}

/** The claims, if the signature is right and the token hasn't expired. Otherwise null. */
export async function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<TokenClaims | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, toBase64Url(await hmac(payload, secret)))) return null;
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
  if (!isClaims(claims) || claims.exp * 1000 <= now) return null;
  return claims;
}

/** Whether `authorization` is `Bearer <secret>`, compared in constant time. */
export function isAuthorized(authorization: string | null, secret: string): boolean {
  return authorization !== null && safeEqual(authorization, `Bearer ${secret}`);
}

export function parseBoardEvent(value: unknown): BoardEvent | null {
  if (!isRecord(value) || typeof value.actorId !== "string") return null;
  switch (value.type) {
    case "task.created":
    case "task.updated":
    case "task.moved":
    case "task.deleted":
    case "comment.changed":
      return typeof value.taskId === "string" && isRoomId(value.taskId)
        ? { type: value.type, taskId: value.taskId, actorId: value.actorId }
        : null;
    case "column.changed":
    case "board.changed":
      return { type: value.type, actorId: value.actorId };
    default:
      return null;
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_CLIENT_MESSAGE) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { taskId } = value;
  const validTask = typeof taskId === "string" && isRoomId(taskId);
  if (value.type === "viewing") {
    if (taskId === null) return { type: "viewing", taskId: null };
    return validTask ? { type: "viewing", taskId } : null;
  }
  if (value.type === "typing") return validTask ? { type: "typing", taskId } : null;
  return null;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.type === "event") {
    const event = parseBoardEvent(value.event);
    return event ? { type: "event", event } : null;
  }
  if (value.type === "presence" && Array.isArray(value.viewers)) {
    return { type: "presence", viewers: value.viewers.filter(isPresenceEntry) };
  }
  const { viewer, taskId } = value;
  if (
    value.type === "typing" &&
    typeof taskId === "string" &&
    isRecord(viewer) &&
    isViewer(viewer)
  ) {
    const { id, name, image } = viewer as unknown as Viewer;
    return { type: "typing", viewer: { id, name, image }, taskId };
  }
  return null;
}

function isClaims(value: unknown): value is TokenClaims {
  return (
    isRecord(value) &&
    typeof value.room === "string" &&
    typeof value.exp === "number" &&
    isViewer(value)
  );
}

function isPresenceEntry(value: unknown): value is PresenceEntry {
  return (
    isRecord(value) &&
    typeof value.connectionId === "string" &&
    (value.taskId === null || typeof value.taskId === "string") &&
    isViewer(value)
  );
}

function isViewer(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.image === null || typeof value.image === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Compares in time that depends only on the length, so a signature can't be guessed bytewise. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
