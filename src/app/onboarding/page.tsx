import { Building2, Mail } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AuthHeading } from "@/components/auth/fields";
import { CreateOrganizationForm } from "@/components/orgs/create-organization-form";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, isRole } from "@/lib/roles";
import { requireSession } from "@/server/auth/session";
import { listInvitationsForEmail } from "@/server/services/members";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your organization" };

export default function OnboardingPage() {
  return (
    <div className="grid gap-6">
      <Suspense>
        <PendingInvitations />
      </Suspense>
      <AuthHeading
        icon={<Building2 className="size-5" aria-hidden />}
        title="Create your organization"
        description="An organization holds your projects, team and clients. You can rename it later."
      />
      <CreateOrganizationForm />
    </div>
  );
}

/** Invitations waiting for this user, so invited people join instead of starting from scratch. */
async function PendingInvitations() {
  const session = await requireSession();
  if (!session.user.emailVerified) return null;
  const invitations = await listInvitationsForEmail(session.user.email);
  if (invitations.length === 0) return null;

  return (
    <section
      className="grid gap-3 rounded-2xl border bg-muted/40 p-4"
      aria-labelledby="invites-heading"
    >
      <h2 id="invites-heading" className="flex items-center gap-2 text-sm font-medium">
        <Mail className="size-4 text-primary" aria-hidden /> You&apos;ve been invited
      </h2>
      <ul className="grid gap-2">
        {invitations.map((invite) => (
          <li key={invite.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">{invite.organizationName}</span>
              {invite.role && isRole(invite.role) && (
                <span className="text-muted-foreground">
                  {" "}
                  as {ROLE_LABELS[invite.role].toLowerCase()}
                </span>
              )}
            </span>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href={`/invitations/${invite.id}`}>View</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
