import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID_HEADER = "x-request-id";
// Accept caller-supplied IDs only if they are short and safe to log.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Gives every request an ID, passed to the app and returned to the caller. */
export function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER) ?? "";
  const requestId = VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
