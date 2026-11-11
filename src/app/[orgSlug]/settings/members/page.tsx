import { PageHeader } from "@/components/app/page-header";
import { InvitationsTable } from "@/components/members/invitations-table";
import { InviteMemberDialog } from "@/components/members/invite-member-dialog";
import { MembersTable } from "@/components/members/members-table";
import { formatDate, formatRelativeDays } from "@/lib/format";
import { canInvite, INVITABLE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/server/auth/org";
import { listMembers, listPendingInvitations } from "@/server/services/members";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/[orgSlug]/settings/members">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  const canManage = role === "owner" || role === "admin";
  const [members, invitations] = await Promise.all([
    listMembers(user.id, org.id),
    canManage ? listPendingInvitations(user.id, org.id) : Promise.resolve([]),
  ]);
  const invitableRoles = INVITABLE_ROLES.filter((r) => canInvite(role, r));

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Members"
        description={`People who can access ${org.name}.`}
        actions={
          canManage && <InviteMemberDialog organizationId={org.id} roles={[...invitableRoles]} />
        }
      />

      <section className="grid gap-3" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-sm font-medium">
          {members.length} {members.length === 1 ? "member" : "members"}
        </h2>
        <MembersTable
          organizationId={org.id}
          organizationName={org.name}
          currentUserId={user.id}
          actorRole={role}
          members={members.map((m) => ({ ...m, joined: formatDate(m.joinedAt) }))}
        />
      </section>

      {canManage && invitations.length > 0 && (
        <section className="grid gap-3" aria-labelledby="invitations-heading">
          <h2 id="invitations-heading" className="text-sm font-medium">
            Pending invitations
          </h2>
          <InvitationsTable
            organizationId={org.id}
            invitations={invitations.map((i) => ({
              ...i,
              expires: `Expires ${formatRelativeDays(i.expiresAt)}`,
            }))}
          />
        </section>
      )}
    </div>
  );
}
