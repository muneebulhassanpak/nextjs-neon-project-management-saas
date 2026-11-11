import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { isRole, type Role } from "@/lib/roles";
import { db } from "@/server/db/client";
import { member, organization } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";
import { NotFoundError } from "@/server/errors";

export interface Membership {
  memberId: string;
  role: Role;
  org: { id: string; name: string; slug: string; logo: string | null };
}

const membershipColumns = {
  memberId: member.id,
  role: member.role,
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  logo: organization.logo,
};

function toMembership(row: {
  memberId: string;
  role: string;
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}): Membership {
  // Unknown roles (e.g. from manual edits) get the least access.
  const role = isRole(row.role) ? row.role : "client";
  return {
    memberId: row.memberId,
    role,
    org: { id: row.id, name: row.name, slug: row.slug, logo: row.logo },
  };
}

/** Every organization the user belongs to, by name. */
export async function listMemberships(userId: string): Promise<Membership[]> {
  const rows = await withOrgContext({ userId, orgId: null }, (tx) =>
    tx
      .select(membershipColumns)
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(asc(organization.name)),
  );
  return rows.map(toMembership);
}

/** The user's membership in the organization with this slug, or `null` if they aren't in it. */
export async function findMembershipBySlug(
  userId: string,
  slug: string,
): Promise<Membership | null> {
  const [row] = await withOrgContext({ userId, orgId: null }, (tx) =>
    tx
      .select(membershipColumns)
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.userId, userId), eq(organization.slug, slug)))
      .limit(1),
  );
  return row ? toMembership(row) : null;
}

/** Number of members in the organization the context is scoped to. */
export async function countMembers(userId: string, orgId: string): Promise<number> {
  const rows = await withOrgContext({ userId, orgId }, (tx) =>
    tx.select({ id: member.id }).from(member).where(eq(member.organizationId, orgId)),
  );
  return rows.length;
}

/** The user's membership in the organization with this id, or `null` if they aren't in it. */
export async function findMembershipById(
  userId: string,
  orgId: string,
): Promise<Membership | null> {
  const [row] = await withOrgContext({ userId, orgId }, (tx) =>
    tx
      .select(membershipColumns)
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.userId, userId), eq(organization.id, orgId)))
      .limit(1),
  );
  return row ? toMembership(row) : null;
}

/**
 * Makes `newOwnerMemberId` the owner and the current owner an admin, in one transaction so the
 * organization never ends up with zero or two owners. Callers must check the actor is the owner.
 */
export async function transferOwnership(input: {
  orgId: string;
  currentOwnerMemberId: string;
  newOwnerMemberId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const promoted = await tx
      .update(member)
      .set({ role: "owner" })
      .where(and(eq(member.id, input.newOwnerMemberId), eq(member.organizationId, input.orgId)))
      .returning({ id: member.id });
    if (promoted.length !== 1)
      throw new NotFoundError("That member is no longer in this organization.");

    await tx
      .update(member)
      .set({ role: "admin" })
      .where(
        and(eq(member.id, input.currentOwnerMemberId), eq(member.organizationId, input.orgId)),
      );
  });
}

/** Where a user's home is: their active organization, their first one, or onboarding. */
export async function resolveHomePath(
  userId: string,
  activeOrgId?: string | null,
): Promise<string> {
  const memberships = await listMemberships(userId);
  const home = memberships.find((m) => m.org.id === activeOrgId) ?? memberships[0];
  return home ? `/${home.org.slug}` : "/onboarding";
}
