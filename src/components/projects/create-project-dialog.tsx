"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction } from "@/server/actions/projects";

import { MemberChecklist, type AssignableMember } from "./member-checklist";

export function CreateProjectDialog({
  orgId,
  members,
  trigger,
}: {
  orgId: string;
  members: AssignableMember[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // On success the action redirects to the new board, so only errors come back.
  const [state, formAction] = useActionState(createProjectAction, null);
  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus aria-hidden /> New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            It starts with a board: To do, In progress, Review and Done. You can change the columns
            later.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="orgId" value={orgId} />
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              placeholder="Website redesign"
              required
              maxLength={80}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="project-description"
              name="description"
              placeholder="What is this project about?"
              maxLength={500}
              rows={3}
              aria-invalid={Boolean(fieldErrors?.description)}
            />
            {fieldErrors?.description && (
              <p className="text-sm text-destructive">{fieldErrors.description[0]}</p>
            )}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Members</legend>
            <MemberChecklist members={members} name="memberIds" />
          </fieldset>
          {state?.ok === false && !fieldErrors && <FormMessage>{state.error.message}</FormMessage>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <SubmitButton>Create project</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
