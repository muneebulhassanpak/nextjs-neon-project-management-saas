import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/server/auth";
import { resolveHomePath } from "@/server/services/organizations";

/**
 * Where users land after signing in: their active organization, their first one,
 * or onboarding if they don't belong to any yet.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const home = await resolveHomePath(session.user.id, session.session.activeOrganizationId);
  return NextResponse.redirect(new URL(home, request.url));
}
