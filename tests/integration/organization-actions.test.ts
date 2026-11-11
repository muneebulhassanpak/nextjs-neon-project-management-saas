import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createOrganization,
  deleteOrganization,
  switchOrganization,
  transferOwnershipAction,
  updateOrganization,
} from "@/server/actions/organizations";
import { db } from "@/server/db/client";
import { member, organization } from "@/server/db/schema";
import { findMembershipBySlug } from "@/server/services/organizations";

import { addMember } from "./helpers/factories";
import { form } from "./helpers/forms";
import { actAs, redirectTarget, signedInUser, type SignedInUser } from "./helpers/session";

function uniqueSlug() {
  return `org-${randomUUID().slice(0, 8)}`;
}

/** An organization created through the real action, owned by `owner`. */
async function organizationOwnedBy(owner: SignedInUser, name = "Acme") {
  actAs(owner);
  const slug = uniqueSlug();
  await redirectTarget(createOrganization(null, form({ name, slug })));
  const membership = await findMembershipBySlug(owner.id, slug);
  if (!membership) throw new Error("Organization was not created");
  return membership;
}

describe("createOrganization", () => {
  it("makes the creator the owner and opens the organization", async () => {
    const ada = await signedInUser("Ada");
    actAs(ada);
    const slug = uniqueSlug();

    expect(await redirectTarget(createOrganization(null, form({ name: "Acme", slug })))).toBe(
      `/${slug}`,
    );
    expect((await findMembershipBySlug(ada.id, slug))?.role).toBe("owner");
  });

  it("returns field errors for an invalid slug", async () => {
    actAs(await signedInUser("Ada"));

    const result = await createOrganization(null, form({ name: "Acme", slug: "settings" }));

    expect(result).toMatchObject({ ok: false, error: { code: "validation_error" } });
    expect(result.ok || result.error.fieldErrors?.slug).toBeTruthy();
  });

  it("refuses a slug another organization already uses", async () => {
    const ada = await signedInUser("Ada");
    const taken = await organizationOwnedBy(ada);

    const result = await createOrganization(null, form({ name: "Other", slug: taken.org.slug }));

    expect(result.ok).toBe(false);
  });
});

describe("switchOrganization", () => {
  it("opens the chosen organization", async () => {
    const ada = await signedInUser("Ada");
    const { org } = await organizationOwnedBy(ada);

    expect(await redirectTarget(switchOrganization(org.id, org.slug))).toBe(`/${org.slug}`);
  });
});

describe("updateOrganization", () => {
  it("renames the organization and stays on the page", async () => {
    const ada = await signedInUser("Ada");
    const { org } = await organizationOwnedBy(ada);

    const result = await updateOrganization(
      null,
      form({ organizationId: org.id, name: "Acme Inc", slug: org.slug }),
    );

    expect(result).toEqual({ ok: true, data: { slug: org.slug } });
    const [row] = await db.select().from(organization).where(eq(organization.id, org.id));
    expect(row?.name).toBe("Acme Inc");
  });

  it("redirects to the new URL when the slug changes", async () => {
    const ada = await signedInUser("Ada");
    const { org } = await organizationOwnedBy(ada);
    const slug = uniqueSlug();

    expect(
      await redirectTarget(
        updateOrganization(null, form({ organizationId: org.id, name: "Acme", slug })),
      ),
    ).toBe(`/${slug}/settings`);
  });

  it("is refused for members", async () => {
    const ada = await signedInUser("Ada");
    const grace = await signedInUser("Grace");
    const { org } = await organizationOwnedBy(ada);
    await addMember(org.id, grace.id, "member");
    actAs(grace);

    const result = await updateOrganization(
      null,
      form({ organizationId: org.id, name: "Hacked", slug: org.slug }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("is refused for people outside the organization", async () => {
    const ada = await signedInUser("Ada");
    const { org } = await organizationOwnedBy(ada);
    actAs(await signedInUser("Mallory"));

    const result = await updateOrganization(
      null,
      form({ organizationId: org.id, name: "Hacked", slug: org.slug }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("transferOwnershipAction", () => {
  it("hands ownership to a member and makes the old owner an admin", async () => {
    const ada = await signedInUser("Ada");
    const grace = await signedInUser("Grace");
    const { org, memberId } = await organizationOwnedBy(ada);
    const target = await addMember(org.id, grace.id, "member");

    expect(await transferOwnershipAction(org.id, target.id)).toEqual({ ok: true, data: null });
    const roles = await db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(eq(member.organizationId, org.id));
    expect(roles).toEqual(
      expect.arrayContaining([
        { id: memberId, role: "admin" },
        { id: target.id, role: "owner" },
      ]),
    );
  });

  it("can't make a client the owner", async () => {
    const ada = await signedInUser("Ada");
    const client = await signedInUser("Client");
    const { org } = await organizationOwnedBy(ada);
    const target = await addMember(org.id, client.id, "client");

    expect(await transferOwnershipAction(org.id, target.id)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("can't transfer to yourself", async () => {
    const ada = await signedInUser("Ada");
    const { org, memberId } = await organizationOwnedBy(ada);

    expect(await transferOwnershipAction(org.id, memberId)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("is refused for admins", async () => {
    const ada = await signedInUser("Ada");
    const grace = await signedInUser("Grace");
    const { org } = await organizationOwnedBy(ada);
    const admin = await addMember(org.id, grace.id, "admin");
    actAs(grace);

    expect(await transferOwnershipAction(org.id, admin.id)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});

describe("deleteOrganization", () => {
  it("needs the exact organization name", async () => {
    const ada = await signedInUser("Ada");
    const { org } = await organizationOwnedBy(ada, "Acme");

    expect(await deleteOrganization(org.id, "acme")).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("deletes the organization and goes to the next one, or onboarding", async () => {
    const ada = await signedInUser("Ada");
    const first = await organizationOwnedBy(ada, "Acme");
    const second = await organizationOwnedBy(ada, "Beta");

    expect(await redirectTarget(deleteOrganization(second.org.id, " Beta "))).toBe(
      `/${first.org.slug}`,
    );
    expect(await redirectTarget(deleteOrganization(first.org.id, "Acme"))).toBe("/onboarding");
  });

  it("is refused for admins", async () => {
    const ada = await signedInUser("Ada");
    const grace = await signedInUser("Grace");
    const { org } = await organizationOwnedBy(ada, "Acme");
    await addMember(org.id, grace.id, "admin");
    actAs(grace);

    expect(await deleteOrganization(org.id, "Acme")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});
