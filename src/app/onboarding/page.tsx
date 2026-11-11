import { CreateOrganizationForm } from "@/components/orgs/create-organization-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your organization" };

export default function OnboardingPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your organization</h1>
        <p className="text-sm text-muted-foreground">
          An organization holds your projects, team and clients.
        </p>
      </div>
      <CreateOrganizationForm />
    </div>
  );
}
