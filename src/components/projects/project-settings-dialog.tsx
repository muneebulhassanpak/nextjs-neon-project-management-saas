"use client";

import { Archive, ArchiveRestore, Settings } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/projects";
import {
  setProjectArchivedAction,
  setProjectMembersAction,
  updateProjectAction,
} from "@/server/actions/projects";

import { MemberChecklist, type AssignableMember } from "./member-checklist";

export interface ProjectSettingsView {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archived: boolean;
}

/** Owners and admins: edit details, choose members, archive. */
export function ProjectSettingsDialog({
  project,
  members,
  assignedIds,
}: {
  project: ProjectSettingsView;
  /** People with the member role, who can be added to the project. */
  members: AssignableMember[];
  assignedIds: string[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings aria-hidden /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Owners and admins can change these.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="archive">{project.archived ? "Restore" : "Archive"}</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="pt-3">
            <DetailsForm project={project} />
          </TabsContent>
          <TabsContent value="members" className="pt-3">
            <MembersForm project={project} members={members} assignedIds={assignedIds} />
          </TabsContent>
          <TabsContent value="archive" className="pt-3">
            <ArchiveSection project={project} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DetailsForm({ project }: { project: ProjectSettingsView }) {
  const [state, formAction] = useActionState(updateProjectAction, null);
  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) toast.success("Project updated");
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="orgId" value={project.orgId} />
      <input type="hidden" name="projectId" value={project.id} />
      <div className="grid gap-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          name="name"
          defaultValue={project.name}
          required
          maxLength={80}
          aria-invalid={Boolean(fieldErrors?.name)}
        />
        {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          name="description"
          defaultValue={project.description ?? ""}
          maxLength={500}
          rows={3}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-status">Status</Label>
        <Select name="status" defaultValue={project.status}>
          <SelectTrigger id="settings-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state?.ok === false && !fieldErrors && <FormMessage>{state.error.message}</FormMessage>}
      <SubmitButton className="justify-self-end">Save changes</SubmitButton>
    </form>
  );
}

function MembersForm({
  project,
  members,
  assignedIds,
}: {
  project: ProjectSettingsView;
  members: AssignableMember[];
  assignedIds: string[];
}) {
  const [checked, setChecked] = useState(assignedIds);
  const [pending, startTransition] = useTransition();
  const changed =
    checked.length !== assignedIds.length || checked.some((id) => !assignedIds.includes(id));

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Members only see the projects they&apos;re added to. Owners and admins see every project.
      </p>
      <MemberChecklist
        members={members}
        checked={checked}
        disabled={pending}
        onCheckedChange={(id, isChecked) => {
          setChecked((current) =>
            isChecked ? [...current, id] : current.filter((value) => value !== id),
          );
        }}
      />
      <Button
        className="justify-self-end"
        disabled={!changed || pending}
        onClick={() => {
          startTransition(async () => {
            const result = await setProjectMembersAction({
              orgId: project.orgId,
              projectId: project.id,
              userIds: checked,
            });
            if (result.ok) toast.success("Members updated");
            else toast.error(result.error.message);
          });
        }}
      >
        Save members
      </Button>
    </div>
  );
}

function ArchiveSection({ project }: { project: ProjectSettingsView }) {
  const [pending, startTransition] = useTransition();
  const archive = !project.archived;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {archive
          ? "Archived projects are hidden from the project list and become read-only. Nothing is deleted, and you can restore it any time."
          : "Restoring brings the project back to the list and makes it editable again."}
      </p>
      <Button
        variant={archive ? "outline" : "default"}
        className="justify-self-start"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await setProjectArchivedAction({
              orgId: project.orgId,
              projectId: project.id,
              archived: archive,
            });
            if (result.ok) toast.success(archive ? "Project archived" : "Project restored");
            else toast.error(result.error.message);
          });
        }}
      >
        {archive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
        {archive ? "Archive project" : "Restore project"}
      </Button>
    </div>
  );
}
