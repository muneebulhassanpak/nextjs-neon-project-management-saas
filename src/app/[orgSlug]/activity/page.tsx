import { notFound } from "next/navigation";

import { ActivityLog } from "@/components/activity/activity-log";
import { PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/server/auth/org";
import { listProjects } from "@/server/services/projects";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/activity">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  // Clients only see their shared tasks, not the team's activity.
  if (role === "client") notFound();

  const query = await searchParams;
  const projects = await listProjects({ userId: user.id, orgId: org.id });
  const project = typeof query.project === "string" ? query.project : undefined;
  const page = Number(typeof query.page === "string" ? query.page : 1);

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Activity"
        description={
          role === "owner" || role === "admin"
            ? `Everything that's changed in ${org.name}, newest first.`
            : "Everything that's changed in your projects, newest first."
        }
      />
      <ActivityLog
        orgId={org.id}
        orgSlug={org.slug}
        page={Number.isInteger(page) && page >= 1 ? page : 1}
        // Only projects the user can see; anything else falls back to all of them.
        projectId={projects.some((p) => p.id === project) ? project : undefined}
        projects={projects.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
