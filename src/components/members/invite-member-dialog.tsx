"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";
import { inviteMember } from "@/server/actions/members";

export function InviteMemberDialog({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: Role[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(inviteMember, null);
  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) toast.success(`Invitation sent to ${state.data.email}`);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden /> Invite people
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to your organization</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link to join. Invitations expire after 7 days.
          </DialogDescription>
        </DialogHeader>
        {/* key resets the form after each successful invite. */}
        <form
          key={state?.ok ? state.data.email : "form"}
          action={formAction}
          className="grid gap-4"
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              aria-invalid={Boolean(fieldErrors?.email)}
            />
            {fieldErrors?.email && (
              <p className="text-sm text-destructive">{fieldErrors.email[0]}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select name="role" defaultValue={roles.includes("member") ? "member" : roles[0]}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    <div className="grid text-left">
                      <span>{ROLE_LABELS[role]}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state?.ok === false && !fieldErrors && <FormMessage>{state.error.message}</FormMessage>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Done
            </Button>
            <SubmitButton>Send invitation</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
