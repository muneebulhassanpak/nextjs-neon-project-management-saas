import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Roles and permissions, shared by the server (enforcement) and the UI (what to show).
 * The matrix follows docs/roles: owner > admin > member > client.
 */
export const ROLES = ["owner", "admin", "member", "client"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be given through an invitation. Ownership only moves by transfer. */
export const INVITABLE_ROLES = ["admin", "member", "client"] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  client: "Client",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including billing and deleting the organization.",
  admin: "Manages members, projects and clients.",
  member: "Works on the projects they're assigned to.",
  client: "Read-only access to their own projects.",
};

const statements = {
  ...defaultStatements,
  billing: ["manage"],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    billing: ["manage"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  member: ac.newRole({}),
  client: ac.newRole({}),
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Whether `actor` may change a member from `from` to `to`.
 * Nobody becomes owner this way (ownership moves by transfer), and owners can't be changed.
 * Admins can change members and clients, but not other admins.
 */
export function canChangeRole(actor: Role, from: Role, to: Role): boolean {
  if (from === to) return false;
  if (actor === "owner") return from !== "owner" && to !== "owner";
  if (actor === "admin") return from !== "owner" && from !== "admin" && to !== "owner";
  return false;
}

/** Whether `actor` may remove a member with role `target`. The owner can't be removed. */
export function canRemoveMember(actor: Role, target: Role): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "admin";
  return false;
}

/** Whether `actor` may invite someone with role `role`. Nobody is invited as owner. */
export function canInvite(actor: Role, role: Role): boolean {
  return role !== "owner" && (actor === "owner" || actor === "admin");
}
