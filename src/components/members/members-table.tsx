"use client";

import { LogOut, MoreHorizontal, UserMinus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { avatarTone } from "@/lib/avatar-tone";
import { initials } from "@/lib/initials";
import { canChangeRole, canRemoveMember, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { leaveOrganization, removeMember, updateMemberRole } from "@/server/actions/members";

import { RoleBadge } from "./role-badge";

export interface MemberView {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  joined: string;
}

type Pending = { kind: "remove"; member: MemberView } | { kind: "leave" } | null;

export function MembersTable({
  organizationId,
  organizationName,
  members,
  currentUserId,
  actorRole,
}: {
  organizationId: string;
  organizationName: string;
  members: MemberView[];
  currentUserId: string;
  actorRole: Role;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Pending>(null);

  function changeRole(member: MemberView, role: Role) {
    startTransition(async () => {
      const result = await updateMemberRole(organizationId, member.memberId, role);
      if (result.ok) toast.success(`${member.name} is now ${ROLE_LABELS[role].toLowerCase()}`);
      else toast.error(result.error.message);
    });
  }

  function runConfirmed() {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    startTransition(async () => {
      const result =
        action.kind === "remove"
          ? await removeMember(organizationId, action.member.memberId)
          : await leaveOrganization(organizationId);
      if (!result.ok) toast.error(result.error.message);
      else if (action.kind === "remove") toast.success(`${action.member.name} was removed`);
    });
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Role</TableHead>
              <TableHead className="hidden w-36 md:table-cell">Joined</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const roleOptions = ROLES.filter(
                (role) => role === member.role || canChangeRole(actorRole, member.role, role),
              );
              const canRemove = !isSelf && canRemoveMember(actorRole, member.role);
              const canLeave = isSelf && member.role !== "owner";

              return (
                <TableRow key={member.memberId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {member.image && <AvatarImage src={member.image} alt="" />}
                        <AvatarFallback
                          className={cn("text-xs font-medium", avatarTone(member.userId))}
                        >
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0">
                        <span className="truncate font-medium">
                          {member.name}
                          {isSelf && (
                            <span className="font-normal text-muted-foreground"> (you)</span>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {roleOptions.length > 1 && !isSelf ? (
                      <Select
                        value={member.role}
                        disabled={isPending}
                        onValueChange={(role) => {
                          changeRole(member, role as Role);
                        }}
                      >
                        <SelectTrigger size="sm" aria-label={`Role for ${member.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {member.joined}
                  </TableCell>
                  <TableCell>
                    {(canRemove || canLeave) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            aria-label={`Actions for ${member.name}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canRemove && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setConfirm({ kind: "remove", member });
                              }}
                            >
                              <UserMinus aria-hidden /> Remove from organization
                            </DropdownMenuItem>
                          )}
                          {canLeave && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setConfirm({ kind: "leave" });
                              }}
                            >
                              <LogOut aria-hidden /> Leave organization
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "remove"
                ? `Remove ${confirm.member.name}?`
                : `Leave ${organizationName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "remove"
                ? "They'll lose access to this organization's projects right away. You can invite them again later."
                : "You'll lose access to this organization's projects. Someone will need to invite you to rejoin."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={runConfirmed}>
              {confirm?.kind === "remove" ? "Remove" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
