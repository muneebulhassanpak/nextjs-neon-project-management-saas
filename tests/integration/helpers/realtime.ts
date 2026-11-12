import { vi } from "vitest";

import { afterTasks } from "../../setup/request-scope";

import type { BoardEvent } from "@realtime/protocol";

export interface Published {
  projectId: string;
  event: BoardEvent;
}

/** Forgets the events scheduled so far. */
export function clearPublished(): void {
  afterTasks.length = 0;
}

/** Runs the scheduled `after()` work and returns the events it would have posted. */
export async function publishedEvents(): Promise<Published[]> {
  const sent: Published[] = [];
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const projectId = /\/rooms\/([^/]+)\/events$/.exec(url)?.[1] ?? "";
    sent.push({ projectId, event: JSON.parse(init?.body as string) as BoardEvent });
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  try {
    for (const task of afterTasks.splice(0)) await task();
  } finally {
    fetchSpy.mockRestore();
  }
  return sent;
}
