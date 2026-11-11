"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { textField } from "@/lib/form-data";
import { canChangeRole, canInvite, canRemoveMember, INVITABLE_ROLES, ROLES } from "@/lib/roles";
import { auth } from "@/server/auth";
import { requireOrgMember } from "@/server/auth/org";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import type { ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";
import { findMember } from "@/server/services/members";
import { resolveHomePath } from "@/server/services/organizations";

import { runAction } from "./run-action";

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: z.enum(INVITABLE_ROLES, "Choose a role."),
});

/** Sends an invitation email. Owners and admins only. */
export async function inviteMember(
  _previous: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const input = inviteSchema.parse({
      organizationId: textField(formData, "organizationId"),
      email: textField(formData, "email"),
      role: textField(formData, "role"),
    });
    const actor = await requireOrgMember(input.organizationId);
    if (!canInvite(actor.role, input.role)) {
      throw new ForbiddenError("You can't invite people with this role.");
    }
    if (input.email === actor.user.email.toLowerCase()) {
      throw new ValidationError("You're already a member.");
    }

    await auth.api.createInvitation({ body: input, headers: await headers() });
    logger.info({ orgId: input.organizationId, role: input.role }, "invitation sent");
    refresh();
    return { email: input.email };
  });
}

/** Sends the invitation email again and extends its expiry. */
export async function resendInvitation(
  organizationId: string,
  email: string,
  role: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    const parsedRole = z.enum(INVITABLE_ROLES).parse(role);
    if (!canInvite(actor.role, parsedRole))
      throw new ForbiddenError("You can't manage invitations.");

    await auth.api.createInvitation({
      body: { organizationId, email, role: parsedRole, resend: true },
      headers: await headers(),
    });
    return null;
  });
}

/** Cancels a pending invitation so its link stops working. */
export async function cancelInvitation(
  organizationId: string,
  invitationId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    if (actor.role !== "owner" && actor.role !== "admin") {
      throw new ForbiddenError("You can't manage invitations.");
    }
    await auth.api.cancelInvitation({ body: { invitationId }, headers: await headers() });
    refresh();
    return null;
  });
}

/** Changes a member's role, following the permission matrix in `src/lib/roles.ts`. */
export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    const newRole = z.enum(ROLES).parse(role);
    const target = await findMember(actor.user.id, organizationId, memberId);
    if (!target) throw new NotFoundError("This member no longer exists.");
    if (!canChangeRole(actor.role, target.role, newRole)) {
      throw new ForbiddenError("You can't give this member that role.");
    }

    await auth.api.updateMemberRole({
      body: { organizationId, memberId, role: newRole },
      headers: await headers(),
    });
    logger.info(
      { orgId: organizationId, memberId, from: target.role, to: newRole },
      "role changed",
    );
    refresh();
    return null;
  });
}

/** Removes someone from the organization. */
export async function removeMember(
  organizationId: string,
  memberId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    const target = await findMember(actor.user.id, organizationId, memberId);
    if (!target) throw new NotFoundError("This member no longer exists.");
    if (target.userId === actor.user.id)
      throw new ValidationError("Use “Leave organization” instead.");
    if (!canRemoveMember(actor.role, target.role)) {
      throw new ForbiddenError("You can't remove this member.");
    }

    await auth.api.removeMember({
      body: { organizationId, memberIdOrEmail: memberId },
      headers: await headers(),
    });
    logger.info({ orgId: organizationId, memberId }, "member removed");
    refresh();
    return null;
  });
}

/** Leaves the organization. The owner has to transfer ownership first. */
export async function leaveOrganization(organizationId: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await requireOrgMember(organizationId);
    if (actor.role === "owner") {
      throw new ValidationError("Transfer ownership to someone else before leaving.");
    }
    await auth.api.leaveOrganization({ body: { organizationId }, headers: await headers() });
    return null;
  });
  if (result.ok) redirect(await resolveHomePath((await requireSession()).user.id));
  return result;
}
