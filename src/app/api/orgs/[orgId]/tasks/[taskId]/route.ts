import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { NotFoundError, withErrorHandling } from "@/server/errors";
import { getTask } from "@/server/services/tasks";

/** One task with its description, for the task modal. */
export const GET = withErrorHandling(
  async (_request: Request, { params }: RouteContext<"/api/orgs/[orgId]/tasks/[taskId]">) => {
    const { orgId, taskId } = await params;
    if (!z.uuid().safeParse(taskId).success) throw new NotFoundError("Not found.");
    const actor = await requireApiOrgMember(orgId);
    const task = await getTask({ userId: actor.user.id, orgId }, taskId);
    if (!task) throw new NotFoundError("This task doesn't exist.");
    return Response.json(task);
  },
);
