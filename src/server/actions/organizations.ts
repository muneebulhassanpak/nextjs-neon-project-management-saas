"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { textField } from "@/lib/form-data";
import { orgNameSchema, orgSlugSchema } from "@/lib/organization";
import { auth } from "@/server/auth";
import { requireOrgMember } from "@/server/auth/org";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError, ValidationError } from "@/server/errors";
import type { ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";
import { findMember } from "@/server/services/members";
import { transferOwnership } from "@/server/services/organizations";
import { resolveHomePath } from "@/server/services/organizations";

import { runAction } from "./run-action";

const createOrganizationSchema = z.object({ name: orgNameSchema, slug: orgSlugSchema });

/** Creates an organization with the current user as owner, then opens it. */
export async function createOrganization(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const session = await requireSession();
    const input = createOrganizationSchema.parse({
      name: textField(formData, "name"),
      slug: textField(formData, "slug"),
    });
    const org = await auth.api.createOrganization({ body: input, headers: await headers() });
    logger.info({ orgId: org.id, userId: session.user.id }, "organization created");
    return org.slug;
  });
  if (result.ok) redirect(`/${result.data}`);
  return result;
}

/** Makes an organization the active one (remembered for the next sign-in) and opens it. */
export async function switchOrganization(organizationId: string, slug: string): Promise<void> {
  await requireSession();
  await auth.api.setActiveOrganization({ body: { organizationId }, headers: await headers() });
  redirect(`/${slug}`);
}

const updateOrganizationSchema = z.object({
  organizationId: z.string().min(1),
  name: orgNameSchema,
  slug: orgSlugSchema,
});

/** Renames the organization or changes its URL. Owners and admins only. */
export async function updateOrganization(
  _previous: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const result = await runAction(async () => {
    const input = updateOrganizationSchema.parse({
      organizationId: textField(formData, "organizationId"),
      name: textField(formData, "name"),
      slug: textField(formData, "slug"),
    });
    const actor = await requireOrgMember(input.organizationId);
    if (actor.role !== "owner" && actor.role !== "admin") {
      throw new ForbiddenError("Only owners and admins can change organization settings.");
    }

    await auth.api.updateOrganization({
      body: { organizationId: input.organizationId, data: { name: input.name, slug: input.slug } },
      headers: await headers(),
    });
    return { slug: input.slug, changedSlug: input.slug !== actor.org.slug };
  });
  if (!result.ok) return result;
  // A new URL means the current page no longer exists.
  if (result.data.changedSlug) redirect(`/${result.data.slug}/settings`);
  refresh();
  return { ok: true, data: { slug: result.data.slug } };
}

/** Hands the organization to another member. The current owner becomes an admin. */
export async function transferOwnershipAction(
  organizationId: string,
  newOwnerMemberId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    if (actor.role !== "owner") throw new ForbiddenError("Only the owner can transfer ownership.");
    if (newOwnerMemberId === actor.memberId) throw new ValidationError("You're already the owner.");

    const target = await findMember(actor.user.id, organizationId, newOwnerMemberId);
    if (!target || target.role === "client") {
      throw new ValidationError("Choose an admin or member of this organization.");
    }
    await transferOwnership({
      orgId: organizationId,
      currentOwnerMemberId: actor.memberId,
      newOwnerMemberId,
    });
    logger.info(
      { orgId: organizationId, from: actor.memberId, to: newOwnerMemberId },
      "ownership transferred",
    );
    refresh();
    return null;
  });
}

/** Deletes the organization and everything in it. The owner must type its name to confirm. */
export async function deleteOrganization(
  organizationId: string,
  confirmation: string,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    if (actor.role !== "owner")
      throw new ForbiddenError("Only the owner can delete the organization.");
    if (confirmation.trim() !== actor.org.name) {
      throw new ValidationError("Type the organization name exactly to confirm.");
    }

    await auth.api.deleteOrganization({ body: { organizationId }, headers: await headers() });
    logger.info({ orgId: organizationId, userId: actor.user.id }, "organization deleted");
    return null;
  });
  if (result.ok) redirect(await resolveHomePath((await requireSession()).user.id));
  return result;
}
