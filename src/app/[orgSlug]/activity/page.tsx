import { notFound } from "next/navigation";

import { ActivityLog, type LogFilters } from "@/components/activity/activity-log";
import { PageHeader } from "@/components/app/page-header";
import { isActivityKind } from "@/lib/activity";
import { isIsoDate } from "@/lib/dates";
import { requireOrg } from "@/server/auth/org";
import { listMembers } from "@/server/services/members";
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
  const param = (name: string) => {
    const value = query[name];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const [projects, members] = await Promise.all([
    listProjects({ userId: user.id, orgId: org.id }),
    listMembers(user.id, org.id),
  ]);
  const page = Number(param("page") ?? 1);
  // Anything unrecognised in the URL is ignored rather than an error.
  const project = param("project");
  const person = param("person");
  const kind = param("type");
  const from = param("from");
  const to = param("to");
  const filters: LogFilters = {
    // Only projects the user can see; anything else falls back to all of them.
    projectId: projects.some((p) => p.id === project) ? project : undefined,
    actorId: members.some((m) => m.userId === person) ? person : undefined,
    kind: kind && isActivityKind(kind) ? kind : undefined,
    from: from && isIsoDate(from) ? from : undefined,
    to: to && isIsoDate(to) ? to : undefined,
    q: param("q")?.slice(0, 200),
  };

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
        filters={filters}
        projects={projects.map(({ id, name }) => ({ id, name }))}
        people={members.map(({ userId, name, image }) => ({ id: userId, name, image }))}
      />
    </div>
  );
}
