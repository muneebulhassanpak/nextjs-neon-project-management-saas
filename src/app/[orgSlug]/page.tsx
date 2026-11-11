import { FolderKanban, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/server/auth/org";
import { countMembers } from "@/server/services/organizations";

import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]">): Promise<Metadata> {
  const { org } = await requireOrg((await params).orgSlug);
  return { title: org.name };
}

export default async function OverviewPage({ params }: PageProps<"/[orgSlug]">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  const members = await countMembers(user.id, org.id);
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
            <CardTitle className="flex items-center gap-2">
              Projects <Badge variant="secondary">Coming soon</Badge>
            </CardTitle>
            <CardDescription>Plan work on Kanban boards and in sprints.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
