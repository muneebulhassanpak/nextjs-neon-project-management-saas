import { describe, expect, it } from "vitest";

import { LOCAL_DATABASE_URL, normalizeDatabaseUrl, resolveDatabaseUrl } from "@/server/db/url";

const NEON = "postgresql://user:pw@ep-x-pooler.aws.neon.tech/neondb";

describe("normalizeDatabaseUrl", () => {
  it.each(["prefer", "require", "verify-ca"])("upgrades sslmode=%s to verify-full", (mode) => {
    const url = new URL(normalizeDatabaseUrl(`${NEON}?sslmode=${mode}&channel_binding=require`));

    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
  });

  it("leaves URLs without sslmode alone", () => {
    expect(normalizeDatabaseUrl(LOCAL_DATABASE_URL)).toBe(LOCAL_DATABASE_URL);
  });

  it("keeps sslmode=disable", () => {
    expect(normalizeDatabaseUrl(`${NEON}?sslmode=disable`)).toContain("sslmode=disable");
  });
});

describe("resolveDatabaseUrl", () => {
  it("uses the first non-empty candidate", () => {
    expect(resolveDatabaseUrl("", "  ", NEON)).toBe(NEON);
  });

  it("falls back to the local database", () => {
    expect(resolveDatabaseUrl(undefined, "")).toBe(LOCAL_DATABASE_URL);
  });
});
