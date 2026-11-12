import { cookies } from "next/headers";
import { z } from "zod";

import { ACTIVITY_KINDS } from "@/lib/activity";
import { isIsoDate, TIME_ZONE_COOKIE } from "@/lib/dates";
import { requireApiOrgMember } from "@/server/auth/org";
import { ValidationError, withErrorHandling } from "@/server/errors";
import { listActivity, listActivityLog } from "@/server/services/activity";

const query = z.object({
  projectId: z.uuid().optional(),
  taskId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  // The Activity page's filters (with `page` only).
  actorId: z.string().min(1).max(64).optional(),
  kind: z.enum(ACTIVITY_KINDS).optional(),
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
  q: z.string().max(200).optional(),
});

/**
 * Activity, newest first: `?projectId=`, `?taskId=`, `?cursor=` (from the last page). With
 * `?page=N` it returns numbered pages with totals instead (the Activity page), which also take
 * `?actorId=`, `?kind=`, `?from=`/`?to=` (days in the viewer's time zone) and `?q=`.
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/orgs/[orgId]/activity">) => {
    const { orgId } = await params;
    const actor = await requireApiOrgMember(orgId);
    const filter = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!filter.success) throw new ValidationError("Invalid filter.");
    const scope = { userId: actor.user.id, orgId };
    const { page, projectId, taskId, cursor, q, ...log } = filter.data;
    if (page === undefined)
      return Response.json(await listActivity(scope, { projectId, taskId, cursor }));
    const zone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
    return Response.json(
      await listActivityLog(scope, {
        page,
        projectId,
        search: q,
        timeZone: zone ? decodeURIComponent(zone) : undefined,
        ...log,
      }),
    );
  },
);
