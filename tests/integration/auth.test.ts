import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth";
import { requireOrg } from "@/server/auth/org";
import { requireSession } from "@/server/auth/session";
import { emailSender } from "@/server/integrations/email";

import { request } from "../setup/request-scope";
import { addMember, createOrganization } from "./helpers/factories";
import { actAs, redirectTarget, signedInUser } from "./helpers/session";

const APP_URL = "http://localhost:3000";

/** The error a Next.js navigation helper (`notFound`, `redirect`) throws, as its digest. */
async function navigationDigest(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as { digest?: string }).digest ?? "";
  }
  throw new Error("Expected a navigation error");
}

describe("closed member endpoints", () => {
  it.each(["update-member-role", "remove-member", "invite-member", "delete"])(
    "refuses POST /api/auth/organization/%s from the browser",
    async (endpoint) => {
      const ada = await signedInUser("Ada");

      const response = await auth.handler(
        new Request(`${APP_URL}/api/auth/organization/${endpoint}`, {
          method: "POST",
          headers: {
            cookie: ada.headers.get("cookie") ?? "",
            "content-type": "application/json",
            origin: APP_URL,
          },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(403);
    },
  );

  it("keeps the other organization endpoints open", async () => {
    const ada = await signedInUser("Ada");

    const response = await auth.handler(
      new Request(`${APP_URL}/api/auth/organization/list`, {
        headers: { cookie: ada.headers.get("cookie") ?? "" },
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe("auth emails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends password reset and magic link emails", async () => {
    const ada = await signedInUser("Ada");
    const send = vi.spyOn(emailSender, "send");

    await auth.api.requestPasswordReset({
      body: { email: ada.email, redirectTo: "/reset-password" },
    });
    await auth.api.signInMagicLink({ body: { email: ada.email }, headers: new Headers() });

    expect(send.mock.calls.map(([email]) => [email.to, email.subject])).toEqual([
      [ada.email, "Reset your password"],
      [ada.email, "Your sign-in link"],
    ]);
  });
});

describe("organization slugs through the API", () => {
  it("are held to the same rules as the app's forms", async () => {
    const ada = await signedInUser("Ada");

    await expect(
      auth.api.createOrganization({
        body: { name: "Acme", slug: "settings" },
        headers: ada.headers,
      }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });
});

describe("requireSession", () => {
  it("sends signed-out visitors to sign in", async () => {
    request.headers = new Headers();

    expect(await redirectTarget(requireSession())).toBe("/sign-in");
  });
});

describe("requireOrg", () => {
  it("returns the membership for members", async () => {
    const ada = await signedInUser("Ada");
    const org = await createOrganization("Acme");
    await addMember(org.id, ada.id, "admin");
    actAs(ada);

    await expect(requireOrg(org.slug)).resolves.toMatchObject({
      role: "admin",
      org: { id: org.id },
    });
  });

  it("is a 404 for everyone else, so the organization's existence isn't revealed", async () => {
    const org = await createOrganization("Acme");
    actAs(await signedInUser("Mallory"));

    expect(await navigationDigest(requireOrg(org.slug))).toContain("404");
    expect(await navigationDigest(requireOrg(`missing-${randomUUID()}`))).toContain("404");
  });
});
