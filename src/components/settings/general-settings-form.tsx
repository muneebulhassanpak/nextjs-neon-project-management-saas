"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganization } from "@/server/actions/organizations";

export function GeneralSettingsForm({
  organization,
}: {
  organization: { id: string; name: string; slug: string };
}) {
  const [state, formAction] = useActionState(updateOrganization, null);
  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) toast.success("Settings saved");
  }, [state]);

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Your organization&apos;s name and web address.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 py-6">
          <input type="hidden" name="organizationId" value={organization.id} />
          <div className="grid gap-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              name="name"
              defaultValue={organization.name}
              required
              maxLength={50}
              aria-invalid={Boolean(fieldErrors?.name)}
            />
            {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-slug">URL</Label>
            <Input
              id="org-slug"
              name="slug"
              defaultValue={organization.slug}
              required
              maxLength={40}
              aria-invalid={Boolean(fieldErrors?.slug)}
              aria-describedby="org-slug-hint"
            />
            {fieldErrors?.slug ? (
              <p className="text-sm text-destructive">{fieldErrors.slug[0]}</p>
            ) : (
              <p id="org-slug-hint" className="text-xs text-muted-foreground">
                Changing it breaks old links to this organization.
              </p>
            )}
          </div>
          {state?.ok === false && !fieldErrors && <FormMessage>{state.error.message}</FormMessage>}
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
