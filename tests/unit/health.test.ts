import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("@/server/db/client", () => ({
  db: { execute: () => Promise.reject(new Error("connection refused")) },
}));

describe("GET /api/health", () => {
  it("reports 503 when the database is unreachable", async () => {
    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", database: "unreachable" });
  });
});
