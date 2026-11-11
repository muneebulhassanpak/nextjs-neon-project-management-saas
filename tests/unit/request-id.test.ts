import { describe, expect, it, vi } from "vitest";

import { getRequestId } from "@/server/request-id";

const headers = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(headers) }));

describe("getRequestId", () => {
  it("returns undefined when the proxy didn't set an ID", async () => {
    expect(await getRequestId()).toBeUndefined();
  });

  it("returns the ID set by the proxy", async () => {
    headers.set("x-request-id", "abc-123");

    expect(await getRequestId()).toBe("abc-123");
  });
});
