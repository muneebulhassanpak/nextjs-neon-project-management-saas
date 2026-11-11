import { describe, expect, it } from "vitest";

import { canChangeRole, canInvite, canRemoveMember, isRole, ROLES, type Role } from "@/lib/roles";

/** Every (actor, from, to) combination the matrix allows. Anything else must be refused. */
const ALLOWED_ROLE_CHANGES = new Set([
  // Owners can move anyone except the owner between admin, member and client.
  "owner:admin>member",
  "owner:admin>client",
  "owner:member>admin",
  "owner:member>client",
  "owner:client>admin",
  "owner:client>member",
  // Admins can change members and clients, including promoting them to admin.
  "admin:member>admin",
  "admin:member>client",
  "admin:client>admin",
  "admin:client>member",
]);

describe("canChangeRole", () => {
  const cases = ROLES.flatMap((actor) =>
    ROLES.flatMap((from) => ROLES.map((to) => [actor, from, to] as [Role, Role, Role])),
  );

  it.each(cases)("%s changing %s → %s", (actor, from, to) => {
    expect(canChangeRole(actor, from, to)).toBe(ALLOWED_ROLE_CHANGES.has(`${actor}:${from}>${to}`));
  });
});

describe("canRemoveMember", () => {
  it.each([
    ["owner", "admin", true],
    ["owner", "member", true],
    ["owner", "client", true],
    ["owner", "owner", false],
    ["admin", "member", true],
    ["admin", "client", true],
    ["admin", "admin", false],
    ["admin", "owner", false],
    ["member", "client", false],
    ["client", "member", false],
  ] as [Role, Role, boolean][])("%s removing %s → %s", (actor, target, allowed) => {
    expect(canRemoveMember(actor, target)).toBe(allowed);
  });
});

describe("canInvite", () => {
  it.each([
    ["owner", "admin", true],
    ["owner", "client", true],
    ["admin", "admin", true],
    ["admin", "member", true],
    ["owner", "owner", false],
    ["admin", "owner", false],
    ["member", "member", false],
    ["client", "client", false],
  ] as [Role, Role, boolean][])("%s inviting a %s → %s", (actor, role, allowed) => {
    expect(canInvite(actor, role)).toBe(allowed);
  });
});

describe("isRole", () => {
  it("accepts known roles only", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
  });
});
