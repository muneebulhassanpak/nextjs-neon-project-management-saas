"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { textField } from "@/lib/form-data";
import { PROJECT_STATUSES, projectDescriptionSchema, projectNameSchema } from "@/lib/projects";
import { canManageProjects } from "@/lib/roles";
import { requireOrgMember } from "@/server/auth/org";
import { ForbiddenError } from "@/server/errors";
import type { ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";
import {
  createProject,
  setProjectArchived,
  setProjectMembers,
  updateProject,
} from "@/server/services/projects";

import { runAction } from "./run-action";

/** The acting user, checked to be an owner or admin of the organization. */
async function requireProjectManager(orgId: string) {
  const actor = await requireOrgMember(orgId);
  if (!canManageProjects(actor.role)) {
    throw new ForbiddenError("Only owners and admins can manage projects.");
  }
  return { actor, scope: { userId: actor.user.id, orgId } };
}

const createProjectSchema = z.object({
  orgId: z.string().min(1),
  name: projectNameSchema,
  description: projectDescriptionSchema,
  memberIds: z.array(z.string().min(1)),
});

/** Creates a project with the default columns, then opens its board. */
export async function createProjectAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = createProjectSchema.parse({
      orgId: textField(formData, "orgId"),
      name: textField(formData, "name"),
      description: textField(formData, "description"),
      memberIds: formData.getAll("memberIds").filter((v) => typeof v === "string"),
    });
    const { actor, scope } = await requireProjectManager(input.orgId);
    const project = await createProject(scope, input);
    logger.info({ orgId: input.orgId, projectId: project.id }, "project created");
    return `/${actor.org.slug}/projects/${project.id}`;
  });
  if (result.ok) redirect(result.data);
  return result;
}

const updateProjectSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.uuid(),
  name: projectNameSchema,
  description: projectDescriptionSchema,
  status: z.enum(PROJECT_STATUSES, "Choose a status."),
});

export async function updateProjectAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = updateProjectSchema.parse({
      orgId: textField(formData, "orgId"),
      projectId: textField(formData, "projectId"),
      name: textField(formData, "name"),
      description: textField(formData, "description"),
      status: textField(formData, "status"),
    });
    const { scope } = await requireProjectManager(input.orgId);
    await updateProject(scope, input.projectId, input);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

const archiveSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.uuid(),
  archived: z.boolean(),
});

/** Archives a project (hidden from the list, nothing deleted) or restores it. */
export async function setProjectArchivedAction(
  input: z.input<typeof archiveSchema>,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const { orgId, projectId, archived } = archiveSchema.parse(input);
    const { scope } = await requireProjectManager(orgId);
    await setProjectArchived(scope, projectId, archived);
    logger.info({ orgId, projectId, archived }, "project archive state changed");
    return null;
  });
  if (result.ok) refresh();
  return result;
}

const membersSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.uuid(),
  userIds: z.array(z.string().min(1)).max(500),
});

/** Sets which members are on the project. Owners and admins always have access. */
export async function setProjectMembersAction(
  input: z.input<typeof membersSchema>,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const { orgId, projectId, userIds } = membersSchema.parse(input);
    const { scope } = await requireProjectManager(orgId);
    await setProjectMembers(scope, projectId, userIds);
    return null;
  });
  if (result.ok) refresh();
  return result;
}
