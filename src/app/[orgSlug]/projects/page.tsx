import { FolderKanban } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { canManageProjects } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { requireOrg } from "@/server/auth/org";
import { listMembers } from "@/server/services/members";
import { listProjects } from "@/server/services/projects";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/projects">) {
  const { user, org, role } = await requireOrg((await params).orgSlug);
  const archived = (await searchParams).view === "archived";
  const canManage = canManageProjects(role);
  const scope = { userId: user.id, orgId: org.id };
  const [projects, members] = await Promise.all([
    listProjects(scope, { archived }),
    canManage ? listMembers(user.id, org.id) : Promise.resolve([]),
  ]);
  const assignable = members
    .filter((m) => m.role === "member")
    .map((m) => ({ id: m.userId, name: m.name, email: m.email, image: m.image }));
  const base = `/${org.slug}/projects`;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Projects"
        description={
          canManage
            ? `Every project in ${org.name}.`
            : role === "client"
              ? "Projects shared with you will show up here."
              : "Projects you've been added to."
        }
        actions={canManage && <CreateProjectDialog orgId={org.id} members={assignable} />}
      />

      <nav aria-label="Project views" className="flex gap-1 border-b">
        {[
          { label: "Active", href: base, current: !archived },
          { label: "Archived", href: `${base}?view=archived`, current: archived },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2 text-sm transition-colors",
              tab.current
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="size-5" aria-hidden />
          </div>
          <div className="grid gap-1">
            <p className="font-medium">{archived ? "No archived projects" : "No projects yet"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {archived
                ? "Projects you archive are kept here, with all their tasks."
                : canManage
                  ? "Create a project to start planning work on a board."
                  : "When an owner or admin adds you to a project, it will show up here."}
            </p>
          </div>
          {canManage && !archived && <CreateProjectDialog orgId={org.id} members={assignable} />}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="grid">
              <ProjectCard
                href={`${base}/${project.id}`}
                project={{ ...project, archived: project.archivedAt !== null }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
