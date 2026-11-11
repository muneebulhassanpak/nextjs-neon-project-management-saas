import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DangerZone } from "@/components/settings/danger-zone";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { requireOrg } from "@/server/auth/org";
import { listMembers } from "@/server/services/members";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/[orgSlug]/settings">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  // Members and clients don't see settings at all.
  if (role !== "owner" && role !== "admin") notFound();

  const candidates =
    role === "owner"
      ? (await listMembers(user.id, org.id)).filter(
          (m) => m.userId !== user.id && (m.role === "admin" || m.role === "member"),
        )
      : [];

  return (
    <div className="grid gap-8">
      <PageHeader title="Settings" description={`Manage ${org.name}.`} />
      <GeneralSettingsForm organization={org} />
      {role === "owner" && <DangerZone organization={org} candidates={candidates} />}
    </div>
  );
}
