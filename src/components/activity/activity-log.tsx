"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PersonAvatar, type PersonView } from "@/components/projects/people";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_KINDS,
  isActivityKind,
  type ActivityKind,
} from "@/lib/activity";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { ActivityLogPage } from "@/server/services/activity";

import { ActivityEntry, type ActivityJson } from "./activity-feed";
import { DateRangeFilter } from "./date-range-filter";

type ActivityLogPageJson = Omit<ActivityLogPage, "items"> & { items: ActivityJson[] };

const ALL = "all";

/** The Activity page's filters, as they appear in its URL. */
export interface LogFilters {
  projectId?: string;
  actorId?: string;
  kind?: ActivityKind;
  /** YYYY-MM-DD, inclusive, in the viewer's time zone. */
  from?: string;
  to?: string;
  q?: string;
}

const URL_KEYS = {
  projectId: "project",
  actorId: "person",
  kind: "type",
  from: "from",
  to: "to",
  q: "q",
} as const satisfies Record<keyof LogFilters, string>;

/** The whole activity log, a page at a time, grouped by day, with filters kept in the URL. */
export function ActivityLog({
  orgId,
  orgSlug,
  page,
  filters,
  projects,
  people,
}: {
  orgId: string;
  orgSlug: string;
  page: number;
  filters: LogFilters;
  projects: { id: string; name: string }[];
  people: PersonView[];
}) {
  const router = useRouter();
  // Under "activity" so live board events refresh it like the other feeds.
  const query = useQuery({
    queryKey: ["activity", orgId, "log", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.projectId) params.set("projectId", filters.projectId);
      if (filters.actorId) params.set("actorId", filters.actorId);
      if (filters.kind) params.set("kind", filters.kind);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.q) params.set("q", filters.q);
      const response = await fetch(`/api/orgs/${orgId}/activity?${params}`);
      if (!response.ok) throw new Error("Couldn't load the activity.");
      return (await response.json()) as ActivityLogPageJson;
    },
    placeholderData: keepPreviousData,
  });

  const href = (to: number, next: LogFilters = filters) => {
    const params = new URLSearchParams();
    for (const [key, name] of Object.entries(URL_KEYS) as [keyof LogFilters, string][]) {
      const value = next[key];
      if (value) params.set(name, value);
    }
    if (to > 1) params.set("page", String(to));
    const search = params.toString();
    return `/${orgSlug}/activity${search ? `?${search}` : ""}`;
  };
  // A new filter starts again from the first page.
  const filter = (patch: Partial<LogFilters>) => {
    router.push(href(1, { ...filters, ...patch }), { scroll: false });
  };

  const [search, setSearch] = useState(filters.q ?? "");
  // Back and forward change the URL's search; the box follows it.
  const [urlSearch, setUrlSearch] = useState(filters.q);
  if (urlSearch !== filters.q) {
    setUrlSearch(filters.q);
    if (search.trim() !== (filters.q ?? "")) setSearch(filters.q ?? "");
  }
  // Search as you type, once typing pauses, on top of the filters at that moment.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const type = (text: string) => {
    setSearch(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = text.trim();
      if (q === (latest.current.q ?? "")) return;
      router.replace(href(1, { ...latest.current, q: q || undefined }), { scroll: false });
    }, 300);
  };
  const clear = () => {
    clearTimeout(timer.current);
    setSearch("");
    router.push(href(1, {}), { scroll: false });
  };

  const filtering = Object.values(filters).some(Boolean);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Filter activity"
        >
          <InputGroup className="h-8 w-full sm:w-64">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              placeholder="Search tasks, projects, people"
              aria-label="Search activity"
              onChange={(event) => {
                type(event.target.value);
              }}
            />
          </InputGroup>

          <DateRangeFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => {
              filter({ from, to });
            }}
          />

          {people.length > 0 && (
            <Select
              value={filters.actorId ?? ALL}
              onValueChange={(value) => {
                filter({ actorId: value === ALL ? undefined : value });
              }}
            >
              <SelectTrigger className="min-w-36" aria-label="Person">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                <SelectSeparator />
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    <PersonAvatar person={person} className="size-5" />
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {projects.length > 0 && (
            <Select
              value={filters.projectId ?? ALL}
              onValueChange={(value) => {
                filter({ projectId: value === ALL ? undefined : value });
              }}
            >
              <SelectTrigger className="min-w-36" aria-label="Project">
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

          <Select
            value={filters.kind ?? ALL}
            onValueChange={(value) => {
              filter({ kind: isActivityKind(value) ? value : undefined });
            }}
          >
            <SelectTrigger className="min-w-32" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All changes</SelectItem>
              <SelectSeparator />
              {ACTIVITY_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {ACTIVITY_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtering && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X aria-hidden /> Clear
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {query.data
            ? query.data.total === 0
              ? "No activity"
              : `${query.data.total.toLocaleString("en-US")} ${query.data.total === 1 ? "entry" : "entries"}`
            : "\u00a0"}
        </p>
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
            {filtering
              ? "Nothing matches these filters."
              : "Once people start working, their changes show up here."}
          </p>
          {filtering && (
            <Button variant="outline" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
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
