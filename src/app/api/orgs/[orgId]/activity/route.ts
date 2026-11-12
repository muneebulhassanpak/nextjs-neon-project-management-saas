import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { ValidationError, withErrorHandling } from "@/server/errors";
import { listActivity, listActivityLog } from "@/server/services/activity";

const query = z.object({
  projectId: z.uuid().optional(),
  taskId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
});

/**
 * Activity, newest first: `?projectId=`, `?taskId=`, `?cursor=` (from the last page). With
 * `?page=N` it returns numbered pages with totals instead (the Activity page).
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/orgs/[orgId]/activity">) => {
    const { orgId } = await params;
    const actor = await requireApiOrgMember(orgId);
    const filter = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!filter.success) throw new ValidationError("Invalid filter.");
    const scope = { userId: actor.user.id, orgId };
    const { page, ...rest } = filter.data;
    return Response.json(
      page === undefined
        ? await listActivity(scope, rest)
        : await listActivityLog(scope, { page, projectId: rest.projectId }),
    );
  },
);
