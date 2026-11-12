import "server-only";
import { after } from "next/server";

import { env } from "@/env";
import { logger } from "@/server/logger";
import { signToken, TOKEN_TTL_SECONDS, type BoardEvent, type Viewer } from "@realtime/protocol";

/*
 * Live boards. The app hands browsers a short-lived token for a board's room on the realtime
 * Worker, and tells the room when something changed. Without REALTIME_URL and REALTIME_SECRET
 * this does nothing, and boards update when they refetch.
 */

export interface RealtimeConfig {
  url: string;
  secret: string;
}

export const realtimeConfig: RealtimeConfig | null =
  env.REALTIME_URL && env.REALTIME_SECRET
    ? { url: env.REALTIME_URL.replace(/\/$/, ""), secret: env.REALTIME_SECRET }
    : null;

/** Where the browser connects for a board, with a token that lets this viewer in. */
export async function connectInfo(
  config: RealtimeConfig,
  viewer: Viewer,
  projectId: string,
  now = Date.now(),
): Promise<{ url: string; token: string }> {
  const token = await signToken(
    { ...viewer, room: projectId, exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS },
    config.secret,
  );
  const url = `${config.url.replace(/^http/, "ws")}/rooms/${projectId}/connect`;
  return { url, token };
}

/**
 * Tells everyone on a board that something changed. Sent after the response, so it never slows
 * the change down, and by then the change has been committed.
 */
export function publishBoardEvent(projectId: string, event: BoardEvent): void {
  const config = realtimeConfig;
  if (!config) return;
  after(() => sendBoardEvent(config, projectId, event));
}

/** Posts the event. Failures are logged, never thrown: live updates are a nicety. */
export async function sendBoardEvent(
  config: RealtimeConfig,
  projectId: string,
  event: BoardEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const response = await fetchImpl(`${config.url}/rooms/${projectId}/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.secret}`, "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      logger.warn(
        { projectId, type: event.type, status: response.status },
        "realtime event rejected",
      );
    }
  } catch (error) {
    logger.warn({ projectId, type: event.type, err: error }, "realtime event not sent");
  }
}
