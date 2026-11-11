"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInvitation, declineInvitation } from "@/server/actions/invitations";

export function InvitationResponse({
  invitationId,
  organizationSlug,
}: {
  invitationId: string;
  organizationSlug: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <Button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await acceptInvitation(invitationId, organizationSlug);
            if (!result.ok) toast.error(result.error.message);
          });
        }}
      >
        Accept invitation
      </Button>
      <Button
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await declineInvitation(invitationId);
            if (!result.ok) toast.error(result.error.message);
          });
        }}
      >
        Decline
      </Button>
    </div>
  );
}
