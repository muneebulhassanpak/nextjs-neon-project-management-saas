import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import { findMembershipBySlug } from "@/server/services/organizations";

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
