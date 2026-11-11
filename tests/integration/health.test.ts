import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

// `connection()` only works inside a Next.js request; here it just needs to resolve.
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

describe("GET /api/health", () => {
  it("reports ok when the database is reachable", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });
});
