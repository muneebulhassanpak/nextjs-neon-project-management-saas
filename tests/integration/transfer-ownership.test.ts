import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { member } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
import { transferOwnership } from "@/server/services/organizations";

import { addMember, createOrganization, createUser } from "./helpers/factories";

async function roleOf(memberId: string) {
  const [row] = await db.select({ role: member.role }).from(member).where(eq(member.id, memberId));
  return row?.role;
}

async function setup() {
  const org = await createOrganization();
  const owner = await addMember(org.id, (await createUser("Owner")).id, "owner");
  const admin = await addMember(org.id, (await createUser("Admin")).id, "admin");
  return { org, owner, admin };
}

describe("transferOwnership", () => {
  it("swaps the owner and the new owner in one step", async () => {
    const { org, owner, admin } = await setup();

    await transferOwnership({
      orgId: org.id,
      currentOwnerMemberId: owner.id,
      newOwnerMemberId: admin.id,
    });

    expect(await roleOf(admin.id)).toBe("owner");
    expect(await roleOf(owner.id)).toBe("admin");
    const owners = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.role, "owner")));
    expect(owners).toHaveLength(1);
  });

  it("changes nothing when the new owner is in another organization", async () => {
    const { org, owner } = await setup();
    const other = await setup();

    await expect(
      transferOwnership({
        orgId: org.id,
        currentOwnerMemberId: owner.id,
        newOwnerMemberId: other.admin.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(await roleOf(owner.id)).toBe("owner");
    expect(await roleOf(other.admin.id)).toBe("admin");
  });
});
