import { requireApiOrgMember } from "@/server/auth/org";
import { withErrorHandling } from "@/server/errors";
import { listNotifications } from "@/server/services/notifications";

/** The user's latest notifications in this organization and the unread count. */
export const GET = withErrorHandling(
  async (_request: Request, { params }: RouteContext<"/api/orgs/[orgId]/notifications">) => {
    const { orgId } = await params;
    const actor = await requireApiOrgMember(orgId);
    return Response.json(await listNotifications({ userId: actor.user.id, orgId }));
  },
);
