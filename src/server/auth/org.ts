import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ForbiddenError } from "@/server/errors";
import { findMembershipById, findMembershipBySlug } from "@/server/services/organizations";

import { requireSession } from "./session";

/**
 * The signed-in user and their membership in the organization at `/[orgSlug]`.
 * Shows a 404 (not a 403) for organizations the user isn't in, so their existence isn't revealed.
 */
export const requireOrg = cache(async (slug: string) => {
  const session = await requireSession();
  const membership = await findMembershipBySlug(session.user.id, slug);
  if (!membership) notFound();
  return { session, user: session.user, ...membership };
});

export type OrgContext = Awaited<ReturnType<typeof requireOrg>>;

/**
 * For Server Actions: the signed-in user's membership in the organization with this id.
 * Actions receive the id from the browser, so membership is always re-checked here.
 */
export async function requireOrgMember(orgId: string) {
  const session = await requireSession();
  const membership = await findMembershipById(session.user.id, orgId);
  if (!membership) throw new ForbiddenError("You're not a member of this organization.");
  return { session, user: session.user, ...membership };
}
