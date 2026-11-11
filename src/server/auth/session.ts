import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./index";

/** The current session, read once per request. `null` when signed out. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The signed-in user's session, or a redirect to sign in. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
