import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { invitation } from "@/server/db/schema";
import {
  findMember,
  getInvitationDetails,
  listInvitationsForEmail,
  listMembers,
  listPendingInvitations,
} from "@/server/services/members";
import { countMembers, resolveHomePath } from "@/server/services/organizations";

import { addMember, createInvitation, createOrganization, createUser } from "./helpers/factories";

async function acmeWithTeam() {
  const org = await createOrganization("Acme");
  const zoe = await createUser("Zoe");
  const ada = await createUser("Ada");
  const owner = await createUser("Owner");
  await addMember(org.id, zoe.id, "member");
  await addMember(org.id, ada.id, "client");
  const ownerMember = await addMember(org.id, owner.id, "owner");
  return { org, zoe, ada, owner, ownerMember };
}

describe("listMembers", () => {
  it("lists owners first, then by role and name", async () => {
    const { org, owner } = await acmeWithTeam();

    const members = await listMembers(owner.id, org.id);

    expect(members.map((m) => [m.name, m.role])).toEqual([
      ["Owner", "owner"],
      ["Zoe", "member"],
      ["Ada", "client"],
    ]);
    expect(await countMembers(owner.id, org.id)).toBe(3);
  });

  it("shows nothing to people outside the organization", async () => {
    const { org } = await acmeWithTeam();
    const outsider = await createUser("Mallory");

    expect(await listMembers(outsider.id, org.id)).toEqual([]);
    expect(await countMembers(outsider.id, org.id)).toBe(0);
  });
});

describe("findMember", () => {
  it("finds members of the organization only", async () => {
    const { org, owner, ownerMember } = await acmeWithTeam();
    const other = await createOrganization("Globex");

    expect(await findMember(owner.id, org.id, ownerMember.id)).toEqual({
      memberId: ownerMember.id,
      userId: owner.id,
      role: "owner",
    });
    expect(await findMember(owner.id, other.id, ownerMember.id)).toBeNull();
  });
});

describe("invitations", () => {
  it("lists pending, unexpired invitations with the inviter's name", async () => {
    const { org, owner } = await acmeWithTeam();
    const pending = await createInvitation(org.id, owner.id, "pending@example.com");
    const expired = await createInvitation(org.id, owner.id, "expired@example.com");
    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitation.id, expired.id));
    const accepted = await createInvitation(org.id, owner.id, "accepted@example.com");
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, accepted.id));

    expect(await listPendingInvitations(owner.id, org.id)).toEqual([
      {
        id: pending.id,
        email: "pending@example.com",
        role: "member",
        invitedBy: "Owner",
        expiresAt: pending.expiresAt,
      },
    ]);
    expect(await listInvitationsForEmail("PENDING@example.com")).toEqual([
      { id: pending.id, organizationName: "Acme", role: "member" },
    ]);
    expect(await listInvitationsForEmail("expired@example.com")).toEqual([]);

    expect(await getInvitationDetails(expired.id)).toMatchObject({
      organizationName: "Acme",
      organizationSlug: org.slug,
      inviterName: "Owner",
      status: "pending",
      expired: true,
    });
    expect(await getInvitationDetails(pending.id)).toMatchObject({ expired: false });
    expect(await getInvitationDetails("missing")).toBeNull();
  });
});

describe("resolveHomePath", () => {
  it("prefers the active organization, then the first one, then onboarding", async () => {
    const user = await createUser("Ada");
    expect(await resolveHomePath(user.id)).toBe("/onboarding");

    const acme = await createOrganization("Acme");
    const beta = await createOrganization("Beta");
    await addMember(acme.id, user.id, "member");
    await addMember(beta.id, user.id, "member");

    expect(await resolveHomePath(user.id)).toBe(`/${acme.slug}`);
    expect(await resolveHomePath(user.id, beta.id)).toBe(`/${beta.slug}`);
    expect(await resolveHomePath(user.id, "gone")).toBe(`/${acme.slug}`);
  });
});
