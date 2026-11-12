import { FolderKanban, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { PageHeader } from "@/components/app/page-header";
import { DueSoon, ProjectsProgress, StatTiles } from "@/components/overview/dashboard";
import { PersonAvatar } from "@/components/projects/people";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { requireOrg } from "@/server/auth/org";
import { listMembers } from "@/server/services/members";
import { getOverview } from "@/server/services/overview";
import { listProjects } from "@/server/services/projects";
import { viewerToday } from "@/server/today";

import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]">): Promise<Metadata> {
  const { org } = await requireOrg((await params).orgSlug);
  return { title: org.name };
}

export default async function OverviewPage({ params }: PageProps<"/[orgSlug]">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  const scope = { userId: user.id, orgId: org.id };
  const today = await viewerToday();
  const firstName = user.name.split(" ")[0] ?? user.name;
  const canInvite = role === "owner" || role === "admin";

  // Clients only see their shared tasks (Phase 5), not the team's numbers or activity.
  if (role === "client") {
    const projects = await listProjects(scope, { today });
    return (
      <div className="grid gap-8">
        <PageHeader
          title={`Welcome, ${firstName}`}
          description={`Here's what's happening in ${org.name}.`}
        />
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="size-4" aria-hidden />
            </div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {projects.length === 0
                ? "Projects shared with you will show up here."
                : `${projects.length} shared ${projects.length === 1 ? "project" : "projects"}.`}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${org.slug}/projects`}>Open projects</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const [overview, projects, members] = await Promise.all([
    getOverview(scope, today),
    listProjects(scope, { today }),
    listMembers(user.id, org.id),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={
          canInvite
            ? `Here's how ${org.name} is doing today.`
            : "Here's how your projects are doing today."
        }
      />

      <StatTiles stats={overview.stats} projectCount={projects.length} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProjectsProgress projects={projects} orgSlug={org.slug} />
        <DueSoon tasks={overview.dueSoon} today={today} orgSlug={org.slug} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              {canInvite
                ? "What's changed across the organization."
                : "What's changed in your projects."}
            </CardDescription>
            <CardAction>
              <Link
                href={`/${org.slug}/activity`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              orgId={org.id}
              orgSlug={org.slug}
              limit={6}
              empty="Once people start working, their changes show up here."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="size-4" aria-hidden />
            </div>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              {members.length === 1
                ? "Just you so far."
                : `${members.length} people in ${org.name}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {members.slice(0, 6).map((member) => (
                <li key={member.userId} className="flex items-center gap-3 text-sm">
                  <PersonAvatar
                    person={{ id: member.userId, name: member.name, image: member.image }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                </li>
              ))}
            </ul>
            {members.length > 6 && (
              <p className="mt-3 text-xs text-muted-foreground">and {members.length - 6} more</p>
            )}
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${org.slug}/settings/members`}>
                {canInvite ? "Invite your team" : "See members"}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
