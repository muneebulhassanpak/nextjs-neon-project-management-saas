import { describe, expect, it } from "vitest";

import { AFTER_SIGN_IN_PATH, isPublicPath, safeNextPath } from "@/lib/routes";

describe("isPublicPath", () => {
  it.each(["/", "/sign-in", "/sign-up", "/api/health", "/invitations/abc"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/dashboard", "/onboarding", "/acme", "/acme/settings"])("%s needs a session", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps relative paths", () => {
    expect(safeNextPath("/acme/settings?tab=members")).toBe("/acme/settings?tab=members");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "replaces %s with the default",
    (next) => {
      expect(safeNextPath(next)).toBe(AFTER_SIGN_IN_PATH);
    },
  );
});
