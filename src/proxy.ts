import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "@/lib/routes";

const REQUEST_ID_HEADER = "x-request-id";
// Accept caller-supplied IDs only if they are short and safe to log.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Runs before every request:
 * 1. Gives it an ID, passed to the app and returned to the caller.
 * 2. Sends visitors without a session cookie to sign in. This is only a fast first check;
 *    pages and actions still verify the session itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isPublicPath(pathname) && !getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }

  const incoming = request.headers.get(REQUEST_ID_HEADER) ?? "";
  const requestId = VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  // Skip static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
