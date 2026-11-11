"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { textField } from "@/lib/form-data";
import { orgNameSchema, orgSlugSchema } from "@/lib/organization";
import { auth } from "@/server/auth";
import { requireSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";

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
