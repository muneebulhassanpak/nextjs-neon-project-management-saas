import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { invitation, member, organization, user } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";

import { addMember, createTwoTenants, createUser } from "./helpers/factories";

type Tenants = Awaited<ReturnType<typeof createTwoTenants>>;

describe("row-level security", () => {
  let t: Tenants;

  beforeAll(async () => {
    t = await createTwoTenants();
  });

  it("shows a user only the organizations they belong to", async () => {
    const orgs = await withOrgContext({ userId: t.alice.id, orgId: t.acme.id }, (tx) =>
      tx.select({ id: organization.id }).from(organization),
    );

    expect(orgs.map((o) => o.id)).toEqual([t.acme.id]);
  });

  it("hides another organization's members and invitations", async () => {
    const result = await withOrgContext({ userId: t.alice.id, orgId: t.acme.id }, async (tx) => ({
      members: await tx.select({ orgId: member.organizationId }).from(member),
      invitations: await tx.select({ id: invitation.id }).from(invitation),
    }));

    expect(new Set(result.members.map((m) => m.orgId))).toEqual(new Set([t.acme.id]));
    expect(result.invitations.map((i) => i.id)).toEqual([t.acmeInvite.id]);
  });

  it("ignores an organization the user doesn't belong to, even if asked for it", async () => {
    // Alice claims to be working in Globex: the database still shows her nothing of it.
    const result = await withOrgContext({ userId: t.alice.id, orgId: t.globex.id }, async (tx) => ({
      orgs: await tx.select({ id: organization.id }).from(organization),
      invitations: await tx.select({ id: invitation.id }).from(invitation),
      users: await tx.select({ id: user.id }).from(user),
    }));

    expect(result.orgs.map((o) => o.id)).toEqual([t.acme.id]);
    expect(result.invitations).toEqual([]);
    expect(result.users.map((u) => u.id)).toEqual([t.alice.id]);
  });

  it("shows the people in the current organization, and no one else", async () => {
    const carol = await createUser("Carol");
    await addMember(t.acme.id, carol.id, "member");

    const users = await withOrgContext({ userId: t.alice.id, orgId: t.acme.id }, (tx) =>
      tx.select({ id: user.id }).from(user),
    );

    expect(new Set(users.map((u) => u.id))).toEqual(new Set([t.alice.id, carol.id]));
  });

  it("shows nothing to a user outside any organization", async () => {
    const stranger = await createUser("Stranger");

    const orgs = await withOrgContext({ userId: stranger.id, orgId: null }, (tx) =>
      tx.select({ id: organization.id }).from(organization),
    );

    expect(orgs).toEqual([]);
  });

  it("can't read password hashes or session tokens at all", async () => {
    await expect(
      withOrgContext({ userId: t.alice.id, orgId: t.acme.id }, (tx) =>
        tx.execute(sql`select password from account`),
      ),
    ).rejects.toMatchObject({ cause: { code: "42501" } }); // insufficient_privilege
  });

  it("doesn't leak the tenant settings to the next transaction", async () => {
    await withOrgContext({ userId: t.alice.id, orgId: t.acme.id }, () => Promise.resolve());

    const { db } = await import("@/server/db/client");
    const result = await db.execute<{ user_id: string | null; role: string }>(
      sql`select current_setting('app.current_user_id', true) as user_id, current_user as role`,
    );

    expect(result.rows[0]?.user_id ?? "").toBe("");
    expect(result.rows[0]?.role).not.toBe("app_user");
  });
});
