import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { ValidationError, withErrorHandling } from "@/server/errors";
import { listActivity } from "@/server/services/activity";

const query = z.object({
  projectId: z.uuid().optional(),
  taskId: z.uuid().optional(),
  cursor: z.uuid().optional(),
});

/** One page of activity, newest first: `?projectId=`, `?taskId=`, `?cursor=` (from the last page). */
export const GET = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/orgs/[orgId]/activity">) => {
    const { orgId } = await params;
    const actor = await requireApiOrgMember(orgId);
    const filter = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!filter.success) throw new ValidationError("Invalid filter.");
    return Response.json(await listActivity({ userId: actor.user.id, orgId }, filter.data));
  },
);
