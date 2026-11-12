import { PageHeader } from "@/components/app/page-header";
import { MyWorkList } from "@/components/my-work/my-work-list";
import { requireOrg } from "@/server/auth/org";
import { listMyWork } from "@/server/services/my-work";
import { viewerToday } from "@/server/today";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "My work" };

export default async function MyWorkPage({ params }: PageProps<"/[orgSlug]/my-work">) {
  const { user, org } = await requireOrg((await params).orgSlug);
  const tasks = await listMyWork({ userId: user.id, orgId: org.id });

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="My work"
        description={`Everything assigned to you in ${org.name}, by when it's due.`}
      />
      <MyWorkList tasks={tasks} serverToday={await viewerToday()} orgSlug={org.slug} />
    </div>
  );
}
