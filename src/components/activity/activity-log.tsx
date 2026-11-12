"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { ActivityLogPage } from "@/server/services/activity";

import { ActivityEntry, type ActivityJson } from "./activity-feed";

type ActivityLogPageJson = Omit<ActivityLogPage, "items"> & { items: ActivityJson[] };

const ALL = "all";

/** The whole activity log, a page at a time, grouped by day, optionally for one project. */
export function ActivityLog({
  orgId,
  orgSlug,
  page,
  projectId,
  projects,
}: {
  orgId: string;
  orgSlug: string;
  page: number;
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  // Under "activity" so live board events refresh it like the other feeds.
  const query = useQuery({
    queryKey: ["activity", orgId, "log", page, projectId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (projectId) params.set("projectId", projectId);
      const response = await fetch(`/api/orgs/${orgId}/activity?${params}`);
      if (!response.ok) throw new Error("Couldn't load the activity.");
      return (await response.json()) as ActivityLogPageJson;
    },
    placeholderData: keepPreviousData,
  });

  const href = (to: number, project = projectId) => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (to > 1) params.set("page", String(to));
    const search = params.toString();
    return `/${orgSlug}/activity${search ? `?${search}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {query.data
            ? query.data.total === 0
              ? "No activity"
              : `${query.data.total} ${query.data.total === 1 ? "entry" : "entries"}`
            : " "}
        </p>
        {projects.length > 0 && (
          <Select
            value={projectId ?? ALL}
            onValueChange={(value) => {
              router.push(href(1, value === ALL ? undefined : value));
            }}
          >
            <SelectTrigger className="w-56" aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              <SelectSeparator />
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {query.isPending ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading activity">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">{query.error.message}</p>
      ) : query.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="size-5" aria-hidden />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {projectId
              ? "Nothing has happened in this project yet."
              : "Once people start working, their changes show up here."}
          </p>
        </div>
      ) : (
        <div
          className={cn("grid gap-6 transition-opacity", query.isPlaceholderData && "opacity-60")}
        >
          {byDay(query.data.items).map(([day, items]) => (
            <section key={day} aria-label={day} className="grid gap-3">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {day}
              </h2>
              <ol className="grid gap-4 rounded-xl border bg-card p-4">
                {items.map((item) => (
                  <ActivityEntry key={item.id} item={item} orgSlug={orgSlug} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {query.data && query.data.pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={href(Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
                tabIndex={page <= 1 ? -1 : undefined}
              />
            </PaginationItem>
            {pageWindow(query.data.page, query.data.pageCount).map((n, i) => (
              <PaginationItem key={n ?? `gap-${i}`}>
                {n === null ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href={href(n)}
                    isActive={n === query.data.page}
                    aria-label={`Page ${n}`}
                  >
                    {n}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={href(Math.min(query.data.pageCount, page + 1))}
                aria-disabled={page >= query.data.pageCount}
                className={cn(page >= query.data.pageCount && "pointer-events-none opacity-50")}
                tabIndex={page >= query.data.pageCount ? -1 : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

/** Entries grouped under "Today", "Yesterday" or the date, in the viewer's time zone. */
function byDay(items: ActivityJson[]): [string, ActivityJson[]][] {
  const groups = new Map<string, ActivityJson[]>();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  for (const item of items) {
    const date = new Date(item.createdAt);
    const label =
      date.toDateString() === now.toDateString()
        ? "Today"
        : date.toDateString() === yesterday.toDateString()
          ? "Yesterday"
          : date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
            });
    const group = groups.get(label);
    if (group) group.push(item);
    else groups.set(label, [item]);
  }
  return [...groups];
}
