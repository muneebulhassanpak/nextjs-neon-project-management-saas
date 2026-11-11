import { vi } from "vitest";

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
