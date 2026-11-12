import { Archive, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { ProjectWorkspace } from "@/components/board/project-workspace";
import { AvatarStack } from "@/components/projects/people";
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";
import { StatusBadge } from "@/components/projects/status-badge";
import { canEditProject, canManageProjects } from "@/lib/roles";
import { requireOrg } from "@/server/auth/org";
import { getBoard } from "@/server/services/board";
import { getProject, listProjectAccess } from "@/server/services/projects";

import type { Metadata } from "next";

type Props = PageProps<"/[orgSlug]/projects/[projectId]">;

/** The project, or a 404 for bad ids and projects the user can't see. Shared with metadata. */
const loadProject = cache(async (orgSlug: string, projectId: string) => {
  const context = await requireOrg(orgSlug);
  if (!z.uuid().safeParse(projectId).success) notFound();
  const scope = { userId: context.user.id, orgId: context.org.id };
  const project = await getProject(scope, projectId);
  if (!project) notFound();
  return { ...context, scope, project };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug, projectId } = await params;
  const { project } = await loadProject(orgSlug, projectId);
  return { title: project.name };
}

export default async function ProjectPage({ params }: Props) {
  const { orgSlug, projectId } = await params;
  const { user, org, role, scope, project } = await loadProject(orgSlug, projectId);
  const canManage = canManageProjects(role);
  const [board, access] = await Promise.all([
    getBoard(scope, project.id),
    canManage ? listProjectAccess(scope, project.id) : Promise.resolve([]),
  ]);
  const archived = project.archivedAt !== null;
  const members = access.filter((person) => person.role === "member");

  return (
    // data-wide lets the board use the full width of the window.
    <div data-wide className="flex min-h-full flex-col gap-5">
      <div className="grid gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href={`/${org.slug}/projects`} className="hover:text-foreground">
            Projects
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span aria-current="page" className="truncate text-foreground">
            {project.name}
          </span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} archived={archived} />
            </div>
            {project.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <AvatarStack people={board.people} max={5} />
            {canManage && (
              <ProjectSettingsDialog
                project={{ ...project, archived }}
                members={members}
                assignedIds={members.filter((m) => m.hasAccess).map((m) => m.id)}
              />
            )}
          </div>
        </div>
      </div>

      {archived && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          <Archive className="size-4" aria-hidden />
          This project is archived, so it&apos;s read-only.
          {canManage && " Restore it from Settings to make changes."}
        </div>
      )}

      <ProjectWorkspace
        // A new key resets the client cache when the project is archived or restored.
        key={archived ? "archived" : "active"}
        context={{
          orgId: org.id,
          projectId: project.id,
          userId: user.id,
          userName: user.name,
          role,
          assigned: project.assigned,
          canEdit: !archived && canEditProject(role, project.assigned),
        }}
        initialBoard={board}
      />
    </div>
  );
}
