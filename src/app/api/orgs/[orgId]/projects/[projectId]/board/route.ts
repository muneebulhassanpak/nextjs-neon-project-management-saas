import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { NotFoundError, withErrorHandling } from "@/server/errors";
import { getBoard } from "@/server/services/board";

/** The board's columns, tasks, people and labels. Refetched by the board after changes. */
export const GET = withErrorHandling(
  async (
    _request: Request,
    { params }: RouteContext<"/api/orgs/[orgId]/projects/[projectId]/board">,
  ) => {
    const { orgId, projectId } = await params;
    if (!z.uuid().safeParse(projectId).success) throw new NotFoundError("Not found.");
    const actor = await requireApiOrgMember(orgId);
    return Response.json(await getBoard({ userId: actor.user.id, orgId }, projectId));
  },
);
