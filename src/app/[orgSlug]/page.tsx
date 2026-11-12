import { FolderKanban, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrg } from "@/server/auth/org";
import { countMembers } from "@/server/services/organizations";
import { listProjects } from "@/server/services/projects";

import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]">): Promise<Metadata> {
  const { org } = await requireOrg((await params).orgSlug);
  return { title: org.name };
}

export default async function OverviewPage({ params }: PageProps<"/[orgSlug]">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  const [members, projects] = await Promise.all([
    countMembers(user.id, org.id),
    listProjects({ userId: user.id, orgId: org.id }),
  ]);
  const firstName = user.name.split(" ")[0] ?? user.name;
  const canInvite = role === "owner" || role === "admin";

  return (
    <div className="grid gap-8">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`Here's what's happening in ${org.name}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="size-4" aria-hidden />
            </div>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              {members === 1 ? "Just you so far." : `${members} people in this organization.`}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${org.slug}/settings/members`}>
                {canInvite ? "Invite your team" : "See members"}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="size-4" aria-hidden />
            </div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {projects.length === 0
                ? "Plan work on Kanban boards."
                : `${projects.length} active ${projects.length === 1 ? "project" : "projects"}.`}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${org.slug}/projects`}>
                {projects.length === 0 && canInvite ? "Create a project" : "Open projects"}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Clients only see their shared tasks (Phase 5), not the team's activity. */}
      {role !== "client" && (
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              {canInvite
                ? "What's changed across the organization."
                : "What's changed in your projects."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              orgId={org.id}
              orgSlug={org.slug}
              empty="Once people start working, their changes show up here."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
