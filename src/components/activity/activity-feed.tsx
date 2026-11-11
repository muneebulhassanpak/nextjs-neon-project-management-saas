"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import Link from "next/link";

import { PersonAvatar } from "@/components/projects/people";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeActivity } from "@/lib/activity";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityItem, ActivityPage } from "@/server/services/activity";

/** Dates arrive as strings. Distributes over the union so `action` still narrows `metadata`. */
type ActivityJson = ActivityItem extends infer T
  ? T extends ActivityItem
    ? Omit<T, "createdAt"> & { createdAt: string }
    : never
  : never;
type ActivityPageJson = Omit<ActivityPage, "items"> & { items: ActivityJson[] };

export const activityKey = (orgId: string, filter: ActivityFilter = {}) =>
  ["activity", orgId, filter] as const;

export interface ActivityFilter {
  projectId?: string;
  taskId?: string;
}

/**
 * Who did what, newest first, 20 at a time. Pass `orgSlug` to link each entry's project
 * (for feeds that mix projects).
 */
export function ActivityFeed({
  orgId,
  filter = {},
  orgSlug,
  empty = "Nothing has happened here yet.",
  className,
}: {
  orgId: string;
  filter?: ActivityFilter;
  orgSlug?: string;
  empty?: string;
  className?: string;
}) {
  const query = useInfiniteQuery({
    queryKey: activityKey(orgId, filter),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filter.projectId) params.set("projectId", filter.projectId);
      if (filter.taskId) params.set("taskId", filter.taskId);
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/orgs/${orgId}/activity?${params}`);
      if (!response.ok) throw new Error("Couldn't load the activity.");
      return (await response.json()) as ActivityPageJson;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  if (query.isPending) {
    return (
      <div className={cn("grid gap-4", className)} aria-busy="true" aria-label="Loading activity">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <p className="text-sm text-destructive">{query.error.message}</p>;
  }

  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
        <History className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <ol className="grid gap-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm">
            {item.actor ? (
              <PersonAvatar person={item.actor} className="mt-px" />
            ) : (
              <span className="mt-px size-6 shrink-0 rounded-full bg-muted" />
            )}
            <div className="grid min-w-0 gap-0.5">
              <p className="leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">{item.actor?.name ?? "Someone"}</span>{" "}
                {describeActivity(item).map((part, i) =>
                  part.strong ? (
                    <span key={i} className="font-medium text-foreground">
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {orgSlug && item.project && (
                  <>
                    <Link
                      href={`/${orgSlug}/projects/${item.project.id}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {item.project.name}
                    </Link>
                    {" · "}
                  </>
                )}
                <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
                  {formatRelativeTime(new Date(item.createdAt))}
                </time>
              </p>
            </div>
          </li>
        ))}
      </ol>
      {query.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start text-muted-foreground"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Show older activity"}
        </Button>
      )}
    </div>
  );
}
