import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { acceptInvitation, declineInvitation } from "@/server/actions/invitations";
import {
  cancelInvitation,
  inviteMember,
  leaveOrganization,
  removeMember,
  resendInvitation,
  updateMemberRole,
} from "@/server/actions/members";
import { createOrganization as createOrganizationAction } from "@/server/actions/organizations";
import { db } from "@/server/db/client";
import { invitation, member } from "@/server/db/schema";
import { findMembershipBySlug } from "@/server/services/organizations";

import { addMember } from "./helpers/factories";
import { form } from "./helpers/forms";
import { actAs, redirectTarget, signedInUser, type SignedInUser } from "./helpers/session";

/** An organization owned by a signed-in owner, with an admin, a member and a client. */
async function team() {
  const owner = await signedInUser("Owner");
  const admin = await signedInUser("Admin");
  const regular = await signedInUser("Member");
  const client = await signedInUser("Client");

  actAs(owner);
  const slug = `org-${randomUUID().slice(0, 8)}`;
  await redirectTarget(createOrganizationAction(null, form({ name: "Acme", slug })));
  const membership = await findMembershipBySlug(owner.id, slug);
  if (!membership) throw new Error("Organization was not created");
  const { org } = membership;

  return {
    org,
    owner: { ...owner, memberId: membership.memberId },
    admin: { ...admin, memberId: (await addMember(org.id, admin.id, "admin")).id },
    member: { ...regular, memberId: (await addMember(org.id, regular.id, "member")).id },
    client: { ...client, memberId: (await addMember(org.id, client.id, "client")).id },
  };
}

async function roleOf(memberId: string) {
  const [row] = await db.select({ role: member.role }).from(member).where(eq(member.id, memberId));
  return row?.role;
}

function invite(orgId: string, email: string, role = "member") {
  return inviteMember(null, form({ organizationId: orgId, email, role }));
}

async function pendingInvitation(orgId: string, email: string) {
  const [row] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.organizationId, orgId), eq(invitation.email, email)));
  if (!row) throw new Error(`No invitation for ${email}`);
  return row;
}

describe("inviteMember", () => {
  it("lets owners and admins invite, normalizing the email", async () => {
    const { org, admin } = await team();
    actAs(admin);

    expect(await invite(org.id, "  New.Person@Example.com ")).toEqual({
      ok: true,
      data: { email: "new.person@example.com" },
    });
    expect((await pendingInvitation(org.id, "new.person@example.com")).status).toBe("pending");
  });

  it.each(["member", "client"] as const)("refuses a %s", async (role) => {
    const people = await team();
    actAs(people[role]);

    expect(await invite(people.org.id, "x@example.com")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("can't invite an owner or yourself", async () => {
    const { org, owner } = await team();
    actAs(owner);

    expect(await invite(org.id, "x@example.com", "owner")).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
    expect(await invite(org.id, owner.email)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("reports people who are already members", async () => {
    const { org, owner, member: regular } = await team();
    actAs(owner);

    const result = await invite(org.id, regular.email);

    expect(result.ok).toBe(false);
  });
});

describe("resendInvitation and cancelInvitation", () => {
  it("resends, then cancels so the link stops working", async () => {
    const { org, owner } = await team();
    actAs(owner);
    await invite(org.id, "later@example.com");
    const pending = await pendingInvitation(org.id, "later@example.com");

    expect(await resendInvitation(org.id, "later@example.com", "member")).toEqual({
      ok: true,
      data: null,
    });
    expect(await cancelInvitation(org.id, pending.id)).toEqual({ ok: true, data: null });
    expect((await pendingInvitation(org.id, "later@example.com")).status).toBe("canceled");
  });

  it("is refused for members", async () => {
    const people = await team();
    actAs(people.owner);
    await invite(people.org.id, "later@example.com");
    const pending = await pendingInvitation(people.org.id, "later@example.com");
    actAs(people.member);

    expect(await resendInvitation(people.org.id, "later@example.com", "member")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(await cancelInvitation(people.org.id, pending.id)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});

describe("updateMemberRole", () => {
  it("lets the owner promote a member to admin", async () => {
    const { org, owner, member: regular } = await team();
    actAs(owner);

    expect(await updateMemberRole(org.id, regular.memberId, "admin")).toEqual({
      ok: true,
      data: null,
    });
    expect(await roleOf(regular.memberId)).toBe("admin");
  });

  it("doesn't let an admin demote another admin", async () => {
    const people = await team();
    const second = await signedInUser("Second admin");
    const secondId = (await addMember(people.org.id, second.id, "admin")).id;
    actAs(people.admin);

    expect(await updateMemberRole(people.org.id, secondId, "member")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(await roleOf(secondId)).toBe("admin");
  });

  it("never makes anyone owner this way", async () => {
    const { org, owner, admin } = await team();
    actAs(owner);

    expect(await updateMemberRole(org.id, admin.memberId, "owner")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("reports members that no longer exist", async () => {
    const { org, owner } = await team();
    actAs(owner);

    expect(await updateMemberRole(org.id, randomUUID(), "admin")).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("removeMember", () => {
  it("lets an admin remove a client", async () => {
    const { org, admin, client } = await team();
    actAs(admin);

    expect(await removeMember(org.id, client.memberId)).toEqual({ ok: true, data: null });
    expect(await roleOf(client.memberId)).toBeUndefined();
  });

  it("doesn't let an admin remove the owner", async () => {
    const { org, admin, owner } = await team();
    actAs(admin);

    expect(await removeMember(org.id, owner.memberId)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });

  it("points people removing themselves to “Leave organization”", async () => {
    const { org, admin } = await team();
    actAs(admin);

    expect(await removeMember(org.id, admin.memberId)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("reports members that no longer exist", async () => {
    const { org, owner } = await team();
    actAs(owner);

    expect(await removeMember(org.id, randomUUID())).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("leaveOrganization", () => {
  it("doesn't let the owner leave", async () => {
    const { org, owner } = await team();
    actAs(owner);

    expect(await leaveOrganization(org.id)).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
  });

  it("lets a member leave and sends them to onboarding", async () => {
    const { org, member: regular } = await team();
    actAs(regular);

    expect(await redirectTarget(leaveOrganization(org.id))).toBe("/onboarding");
    expect(await roleOf(regular.memberId)).toBeUndefined();
  });
});

describe("invitations", () => {
  async function invited(role = "member") {
    const people = await team();
    const guest: SignedInUser = await signedInUser("Guest");
    actAs(people.owner);
    await invite(people.org.id, guest.email, role);
    const pending = await pendingInvitation(people.org.id, guest.email);
    actAs(guest);
    return { ...people, guest, pending };
  }

  it("accepting joins the organization with the invited role", async () => {
    const { org, guest, pending } = await invited("client");

    expect(await redirectTarget(acceptInvitation(pending.id, org.slug))).toBe(`/${org.slug}`);
    expect((await findMembershipBySlug(guest.id, org.slug))?.role).toBe("client");
  });

  it("declining keeps the user out", async () => {
    const { org, guest, pending } = await invited();

    expect(await redirectTarget(declineInvitation(pending.id))).toBe("/onboarding");
    expect(await findMembershipBySlug(guest.id, org.slug)).toBeNull();
    expect((await pendingInvitation(org.id, guest.email)).status).toBe("rejected");
  });

  it("can't be accepted by someone else", async () => {
    const { org, pending } = await invited();
    actAs(await signedInUser("Mallory"));

    expect((await acceptInvitation(pending.id, org.slug)).ok).toBe(false);
    expect((await declineInvitation(pending.id)).ok).toBe(false);
  });
});
