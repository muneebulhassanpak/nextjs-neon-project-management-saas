import { vi } from "vitest";

import type * as NextServer from "next/server";

/**
 * Integration tests call Server Actions directly. Those read the request through next/headers
 * and refresh the page through next/cache, which need a Next.js request scope. Tests set the
 * "current request" with actAs() from tests/integration/helpers/session.ts.
 */
export const request = { headers: new Headers() };

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(request.headers),
  cookies: () => Promise.resolve({ get: () => undefined, set: () => undefined }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

/**
 * Work scheduled with `after()` (realtime events), in order. Not run automatically: tests that
 * care run it with publishedEvents() from tests/integration/helpers/realtime.ts.
 */
export const afterTasks: (() => unknown)[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: (task: unknown) => {
    afterTasks.push(typeof task === "function" ? (task as () => unknown) : () => task);
  },
}));
