import { describe, expect, it } from "vitest";

import { orgNameSchema, orgSlugSchema, slugify } from "@/lib/organization";

describe("slugify", () => {
  it.each([
    ["Acme Design Co.", "acme-design-co"],
    ["  Café  Crème ", "cafe-creme"],
    ["Hello---World!!", "hello-world"],
    ["a".repeat(60), "a".repeat(40)],
  ])("turns %j into %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe("orgSlugSchema", () => {
  it.each(["acme", "acme-design", "team-42"])("accepts %s", (slug) => {
    expect(orgSlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["ab", "-acme", "acme-", "ac--me", "acme_co", "dashboard", "sign-in", "a".repeat(41)])(
    "rejects %s",
    (slug) => {
      expect(orgSlugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it("lowercases input", () => {
    expect(orgSlugSchema.parse("Acme")).toBe("acme");
  });
});

describe("orgNameSchema", () => {
  it("trims and accepts normal names", () => {
    expect(orgNameSchema.parse("  Acme  ")).toBe("Acme");
  });

  it("rejects names that are too short", () => {
    expect(orgNameSchema.safeParse("A").success).toBe(false);
  });
});

describe("initials", async () => {
  const { initials } = await import("@/lib/initials");

  it.each([
    ["Ada Lovelace", "AL"],
    ["acme", "A"],
    ["  Grace   Brewster Hopper ", "GH"],
    ["", "?"],
  ])("%j → %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
