"use client";

import { MoreHorizontal, RotateCw, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/lib/roles";
import { cancelInvitation, resendInvitation } from "@/server/actions/members";

import { RoleBadge } from "./role-badge";

export interface InvitationView {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  expires: string;
}

export function InvitationsTable({
  organizationId,
  invitations,
}: {
  organizationId: string;
  invitations: InvitationView[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead className="w-40">Role</TableHead>
            <TableHead className="hidden w-44 md:table-cell">Expires</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell>
                <div className="grid min-w-0">
                  <span className="truncate font-medium">{invite.email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Invited by {invite.invitedBy}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={invite.role} />
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {invite.expires}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      aria-label={`Actions for invitation to ${invite.email}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        startTransition(async () => {
                          const result = await resendInvitation(
                            organizationId,
                            invite.email,
                            invite.role,
                          );
                          if (result.ok) toast.success(`Invitation resent to ${invite.email}`);
                          else toast.error(result.error.message);
                        });
                      }}
                    >
                      <RotateCw aria-hidden /> Resend invitation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        startTransition(async () => {
                          const result = await cancelInvitation(organizationId, invite.id);
                          if (result.ok) toast.success("Invitation cancelled");
                          else toast.error(result.error.message);
                        });
                      }}
                    >
                      <X aria-hidden /> Cancel invitation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
