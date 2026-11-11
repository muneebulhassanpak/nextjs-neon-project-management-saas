import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";

import { request } from "../../setup/request-scope";

const PASSWORD = "integration-password-1";

export interface SignedInUser {
  id: string;
  name: string;
  email: string;
  /** Headers carrying this user's session cookie. */
  headers: Headers;
}

/** Signs a user up through Better Auth, verifies their email and signs them in. */
export async function signedInUser(name: string): Promise<SignedInUser> {
  const email = `${randomUUID()}@example.com`;
  await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

  const { headers, response } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { id: response.user.id, name, email, headers: new Headers({ cookie }) };
}

/** Makes the next Server Action calls run as this user. */
export function actAs(person: SignedInUser): void {
  request.headers = person.headers;
}

/** Awaits a Server Action that should redirect, and returns where it redirected to. */
export async function redirectTarget(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw error;
  }
  throw new Error("Expected a redirect, but the action returned normally.");
}
