"use client";

import { useActionState, useState } from "react";

import { authSubmitClass } from "@/components/auth/fields";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/organization";
import { createOrganization } from "@/server/actions/organizations";

export function CreateOrganizationForm() {
  const [state, formAction] = useActionState(createOrganization, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Design"
          required
          maxLength={50}
          className="h-10 rounded-xl bg-background px-3.5 shadow-xs dark:bg-input/30"
          value={name}
          aria-invalid={Boolean(fieldErrors?.name)}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
        {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">URL</Label>
        <div className="flex h-10 items-center rounded-xl border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <span className="border-r px-3.5 text-sm text-muted-foreground">stackboard/</span>
          <Input
            id="slug"
            name="slug"
            placeholder="acme-design"
            required
            maxLength={40}
            value={slug}
            aria-invalid={Boolean(fieldErrors?.slug)}
            aria-describedby="slug-hint"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugEdited(true);
            }}
          />
        </div>
        {fieldErrors?.slug ? (
          <p className="text-sm text-destructive">{fieldErrors.slug[0]}</p>
        ) : (
          <p id="slug-hint" className="text-xs text-muted-foreground">
            Lowercase letters, numbers and dashes. You can change it later.
          </p>
        )}
      </div>

      {state?.ok === false && !fieldErrors && <FormMessage>{state.error.message}</FormMessage>}

      <SubmitButton className={authSubmitClass}>Create organization</SubmitButton>
    </form>
  );
}
