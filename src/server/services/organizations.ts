import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { isRole, type Role } from "@/lib/roles";
import { member, organization } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";

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
