"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Bell, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PersonAvatar } from "@/components/projects/people";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/format";
import { splitMentions } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/collaboration";
import type { NotificationItem, NotificationList } from "@/server/services/notifications";

type NotificationJson = Omit<NotificationItem, "createdAt"> & { createdAt: string };
type NotificationListJson = Omit<NotificationList, "items"> & { items: NotificationJson[] };

const POLL_MS = 30_000;

/** The bell in the header: mentions and assignments, polled every 30 seconds. */
export function NotificationBell({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ["notifications", orgId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await fetch(`/api/orgs/${orgId}/notifications`);
      if (!response.ok) throw new Error("Couldn't load notifications.");
      return (await response.json()) as NotificationListJson;
    },
    refetchInterval: POLL_MS,
  });
  const unread = data?.unread ?? 0;

  async function markRead(ids: string[] | "all") {
    queryClient.setQueryData<NotificationListJson>(key, (current) =>
      current
        ? {
            ...current,
            unread: ids === "all" ? 0 : Math.max(0, current.unread - ids.length),
            items: current.items.map((item) =>
              ids === "all" || ids.includes(item.id) ? { ...item, read: true } : item,
            ),
          }
        : current,
    );
    await markNotificationsReadAction({ orgId, ids });
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell aria-hidden />
          <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Notifications</h2>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => void markRead("all")}>
              Mark all as read
            </Button>
          )}
        </div>
        {!data || data.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {data ? "You're all caught up." : "Loading…"}
          </p>
        ) : (
          <ul className="max-h-[26rem] overflow-y-auto py-1">
            {data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${orgSlug}/projects/${item.task.projectId}?task=${item.task.id}`}
                  onClick={() => {
                    setOpen(false);
                    if (!item.read) void markRead([item.id]);
                  }}
                  className="flex gap-3 px-4 py-2.5 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                >
                  <span className="relative">
                    {item.actor ? (
                      <PersonAvatar person={item.actor} size="default" />
                    ) : (
                      <span className="flex size-8 rounded-full bg-muted" />
                    )}
                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                      {item.type === "mention" ? (
                        <AtSign className="size-2.5" aria-hidden />
                      ) : (
                        <UserCheck className="size-2.5" aria-hidden />
                      )}
                    </span>
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
                    <span className={cn(item.read && "text-muted-foreground")}>
                      <span className="font-medium text-foreground">
                        {item.actor?.name ?? "Someone"}
                      </span>{" "}
                      {item.type === "mention" ? "mentioned you in " : "assigned you "}
                      <span className="font-medium text-foreground">{item.task.title}</span>
                    </span>
                    {item.comment && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {splitMentions(item.comment)
                          .map((part) =>
                            part.type === "text"
                              ? part.text
                              : `@${data.people[part.userId] ?? "someone"}`,
                          )
                          .join("")}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.task.projectName} · {formatRelativeTime(new Date(item.createdAt))}
                    </span>
                  </span>
                  {!item.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
