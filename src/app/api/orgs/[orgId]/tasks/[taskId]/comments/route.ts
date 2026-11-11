import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { NotFoundError, withErrorHandling } from "@/server/errors";
import { listComments } from "@/server/services/comments";

/** A task's comments, oldest first. Empty for tasks the user can't see. */
export const GET = withErrorHandling(
  async (
    _request: Request,
    { params }: RouteContext<"/api/orgs/[orgId]/tasks/[taskId]/comments">,
  ) => {
    const { orgId, taskId } = await params;
    if (!z.uuid().safeParse(taskId).success) throw new NotFoundError("Not found.");
    const actor = await requireApiOrgMember(orgId);
    return Response.json(await listComments({ userId: actor.user.id, orgId }, taskId));
  },
);
