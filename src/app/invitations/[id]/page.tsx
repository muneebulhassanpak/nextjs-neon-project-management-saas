import { MailOpen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AuthHeading, authSubmitClass } from "@/components/auth/fields";
import { InvitationResponse } from "@/components/members/invitation-response";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS } from "@/lib/roles";
import { getSession } from "@/server/auth/session";
import { getInvitationDetails } from "@/server/services/members";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invitation" };

export default function InvitationPage({ params }: PageProps<"/invitations/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <Invitation params={params} />
    </Suspense>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <AuthHeading icon={<MailOpen className="size-5" aria-hidden />} title={title} />
      <div className="grid gap-4 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

async function Invitation({ params }: Pick<PageProps<"/invitations/[id]">, "params">) {
  const { id } = await params;
  const [invitation, session] = await Promise.all([getInvitationDetails(id), getSession()]);

  if (!invitation || invitation.status === "canceled") {
    return (
      <Message title="Invitation not found">
        <p>This invitation link is invalid or was cancelled. Ask for a new one.</p>
      </Message>
    );
  }
  if (invitation.status !== "pending" || invitation.expired) {
    return (
      <Message title="Invitation no longer valid">
        <p>
          This invitation has {invitation.expired ? "expired" : "already been used"}. Ask{" "}
          {invitation.organizationName} for a new one.
        </p>
      </Message>
    );
  }

  const next = `/invitations/${id}`;
  const intro = (
    <p>
      {invitation.inviterName ?? "Someone"} invited you to join{" "}
      <span className="font-medium text-foreground">{invitation.organizationName}</span> as{" "}
      {ROLE_LABELS[invitation.role].toLowerCase()}.
    </p>
  );

  if (!session) {
    return (
      <Message title={`Join ${invitation.organizationName}`}>
        {intro}
        <div className="grid gap-2">
          <Button asChild className={authSubmitClass}>
            <Link
              href={`/sign-up?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.email)}`}
            >
              Create an account
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-10 rounded-full">
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>
              I already have an account
            </Link>
          </Button>
        </div>
      </Message>
    );
  }

  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Message title="Wrong account">
        <p>
          This invitation was sent to{" "}
          <span className="font-medium text-foreground">{invitation.email}</span>, but you&apos;re
          signed in as <span className="font-medium text-foreground">{session.user.email}</span>.
        </p>
        <p>Sign out and sign in with the invited email to accept it.</p>
      </Message>
    );
  }

  return (
    <Message title={`Join ${invitation.organizationName}`}>
      {intro}
      <InvitationResponse invitationId={id} organizationSlug={invitation.organizationSlug} />
    </Message>
  );
}
