import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isRole, type Role } from "@/lib/roles";
import { db } from "@/server/db/client";
import { invitation, member, organization, user } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";

export interface MemberRow {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  joinedAt: Date;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  expiresAt: Date;
}

function toRole(value: string | null): Role {
  return value && isRole(value) ? value : "client";
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, member: 2, client: 3 };

/** Members of the current organization: owners first, then by name. Scoped by RLS. */
export async function listMembers(userId: string, orgId: string): Promise<MemberRow[]> {
  const rows = await withOrgContext({ userId, orgId }, (tx) =>
    tx
      .select({
        memberId: member.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(asc(user.name)),
  );
  return rows
    .map((row) => ({ ...row, role: toRole(row.role) }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/** Invitations that can still be accepted, newest first. Scoped by RLS. */
export async function listPendingInvitations(
  userId: string,
  orgId: string,
): Promise<PendingInvitation[]> {
  const inviter = alias(user, "inviter");
  const rows = await withOrgContext({ userId, orgId }, (tx) =>
    tx
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitedBy: inviter.name,
        expiresAt: invitation.expiresAt,
      })
      .from(invitation)
      .leftJoin(inviter, eq(invitation.inviterId, inviter.id))
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(invitation.createdAt)),
  );
  return rows.map((row) => ({
    ...row,
    role: toRole(row.role),
    invitedBy: row.invitedBy ?? "A former member",
  }));
}

/** A member of the current organization by id, or `null`. Scoped by RLS. */
export async function findMember(userId: string, orgId: string, memberId: string) {
  const [row] = await withOrgContext({ userId, orgId }, (tx) =>
    tx
      .select({ memberId: member.id, userId: member.userId, role: member.role })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)))
      .limit(1),
  );
  return row ? { ...row, role: toRole(row.role) } : null;
}

export interface InvitationDetails {
  id: string;
  email: string;
  role: Role;
  status: string;
  expired: boolean;
  organizationName: string;
  organizationSlug: string;
  inviterName: string | null;
}

/**
 * The public details of an invitation, for its accept page. Read outside RLS on purpose:
 * the person opening the link isn't a member yet. The id is a long random token, and only
 * the organization name, inviter name and role are shown.
 */
export async function getInvitationDetails(id: string): Promise<InvitationDetails | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .leftJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, id))
    .limit(1);
  if (!row) return null;
  const { expiresAt, ...details } = row;
  return { ...details, role: toRole(row.role), expired: expiresAt <= new Date() };
}

/** Pending invitations sent to this email address, for the onboarding screen. */
export async function listInvitationsForEmail(email: string) {
  return db
    .select({ id: invitation.id, organizationName: organization.name, role: invitation.role })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.email, email.toLowerCase()),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitation.createdAt));
}
