import { z } from "zod";

import { requireApiOrgMember } from "@/server/auth/org";
import { NotFoundError, withErrorHandling } from "@/server/errors";
import { connectInfo, realtimeConfig } from "@/server/realtime";
import { getProject } from "@/server/services/projects";

/**
 * A token to join the board's live room: `{ url, token }`, or `{ url: null }` when live updates
 * are turned off. Only for people who can see the project.
 */
export const GET = withErrorHandling(
  async (
    _request: Request,
    { params }: RouteContext<"/api/orgs/[orgId]/projects/[projectId]/realtime">,
  ) => {
    const { orgId, projectId } = await params;
    if (!z.uuid().safeParse(projectId).success) throw new NotFoundError("Not found.");
    const actor = await requireApiOrgMember(orgId);
    const project = await getProject({ userId: actor.user.id, orgId }, projectId);
    if (!project) throw new NotFoundError("Not found.");
    if (!realtimeConfig) return Response.json({ url: null, token: null });
    const { id, name, image } = actor.user;
    return Response.json(
      await connectInfo(realtimeConfig, { id, name, image: image ?? null }, projectId),
      { headers: { "cache-control": "no-store" } },
    );
  },
);
