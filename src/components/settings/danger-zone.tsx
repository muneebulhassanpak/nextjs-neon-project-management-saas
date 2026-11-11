"use client";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { deleteOrganization, transferOwnershipAction } from "@/server/actions/organizations";

export interface TransferCandidate {
  memberId: string;
  name: string;
  role: Role;
}

export function DangerZone({
  organization,
  candidates,
}: {
  organization: { id: string; name: string };
  candidates: TransferCandidate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newOwner, setNewOwner] = useState<string>("");
  const [confirmation, setConfirmation] = useState("");
  const newOwnerName = candidates.find((c) => c.memberId === newOwner)?.name;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>These actions can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">Transfer ownership</p>
            <p className="text-sm text-muted-foreground">
              The new owner gets full control. You become an admin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={newOwner} onValueChange={setNewOwner} disabled={candidates.length === 0}>
              <SelectTrigger className="w-48" aria-label="New owner">
                <SelectValue
                  placeholder={candidates.length ? "Choose a member" : "No other members"}
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.memberId} value={c.memberId}>
                    {c.name} <span className="text-muted-foreground">· {ROLE_LABELS[c.role]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!newOwner || isPending}>
                  Transfer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Make {newOwnerName} the owner?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They&apos;ll control billing and can delete the organization. You&apos;ll become
                    an admin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      startTransition(async () => {
                        const result = await transferOwnershipAction(organization.id, newOwner);
                        if (result.ok)
                          toast.success(`${newOwnerName ?? "They"} now own ${organization.name}`);
                        else toast.error(result.error.message);
                      });
                    }}
                  >
                    Transfer ownership
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">Delete organization</p>
            <p className="text-sm text-muted-foreground">
              Permanently deletes {organization.name}, its members and all its data.
            </p>
          </div>
          <AlertDialog
            onOpenChange={() => {
              setConfirmation("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isPending}>
                Delete organization
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Everything in this organization is deleted for everyone. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="delete-confirmation">
                  Type <span className="font-semibold">{organization.name}</span> to confirm
                </Label>
                <Input
                  id="delete-confirmation"
                  value={confirmation}
                  autoComplete="off"
                  onChange={(e) => {
                    setConfirmation(e.target.value);
                  }}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={confirmation.trim() !== organization.name}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteOrganization(organization.id, confirmation);
                      if (!result.ok) toast.error(result.error.message);
                    });
                  }}
                >
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
