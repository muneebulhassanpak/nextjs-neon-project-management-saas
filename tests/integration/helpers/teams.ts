import { randomUUID } from "node:crypto";

import { createOrganization as createOrganizationAction } from "@/server/actions/organizations";
import { createProjectAction } from "@/server/actions/projects";
import { findMembershipBySlug } from "@/server/services/organizations";

import { addMember } from "./factories";
import { form } from "./forms";
import { actAs, redirectTarget, signedInUser, type SignedInUser } from "./session";

export type Teammate = SignedInUser & { memberId: string };

/** An organization with a signed-in owner, admin, two members and a client. */
export async function team() {
  const [owner, admin, alice, bob, client] = await Promise.all([
    signedInUser("Owner"),
    signedInUser("Admin"),
    signedInUser("Alice"),
    signedInUser("Bob"),
    signedInUser("Client"),
  ]);

  actAs(owner);
  const slug = `org-${randomUUID().slice(0, 8)}`;
  await redirectTarget(createOrganizationAction(null, form({ name: "Acme", slug })));
  const membership = await findMembershipBySlug(owner.id, slug);
  if (!membership) throw new Error("Organization was not created");
  const { org } = membership;

  const join = async (person: SignedInUser, role: "admin" | "member" | "client") => ({
    ...person,
    memberId: (await addMember(org.id, person.id, role)).id,
  });

  return {
    org,
    owner: { ...owner, memberId: membership.memberId },
    admin: await join(admin, "admin"),
    alice: await join(alice, "member"),
    bob: await join(bob, "member"),
    client: await join(client, "client"),
  };
}

/** Creates a project through the real action, as `as`, and returns its id. */
export async function projectFor(
  as: SignedInUser,
  orgId: string,
  name = "Website",
  memberIds: string[] = [],
): Promise<string> {
  actAs(as);
  const data = form({ orgId, name, description: "" });
  for (const id of memberIds) data.append("memberIds", id);
  const target = await redirectTarget(createProjectAction(null, data));
  const projectId = target.split("/").at(-1);
  if (!projectId) throw new Error(`Unexpected redirect: ${target}`);
  return projectId;
}
