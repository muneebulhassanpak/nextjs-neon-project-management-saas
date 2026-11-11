import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/server/auth";
import { listMemberships } from "@/server/services/organizations";

/**
 * Where users land after signing in: their active organization, their first one,
 * or onboarding if they don't belong to any yet.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const memberships = await listMemberships(session.user.id);
  const active =
    memberships.find((m) => m.org.id === session.session.activeOrganizationId) ?? memberships[0];

  return NextResponse.redirect(
    new URL(active ? `/${active.org.slug}` : "/onboarding", request.url),
  );
}
