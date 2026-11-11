"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { requireSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";

import { runAction } from "./run-action";

/** Joins the organization. Better Auth checks the invitation was sent to this user's email. */
export async function acceptInvitation(
  invitationId: string,
  organizationSlug: string,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const session = await requireSession();
    await auth.api.acceptInvitation({ body: { invitationId }, headers: await headers() });
    logger.info({ invitationId, userId: session.user.id }, "invitation accepted");
    return null;
  });
  if (result.ok) redirect(`/${organizationSlug}`);
  return result;
}

export async function declineInvitation(invitationId: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    await requireSession();
    await auth.api.rejectInvitation({ body: { invitationId }, headers: await headers() });
    return null;
  });
  if (result.ok) redirect("/dashboard");
  return result;
}
