"use client";

import { Eye } from "lucide-react";

import { AvatarStack } from "@/components/projects/people";
import { cn } from "@/lib/utils";

import { uniqueViewers, type ChannelStatus } from "./use-board-channel";

import type { PresenceEntry } from "@realtime/protocol";

/** Who else is on the board, and whether changes are arriving live. */
export function BoardPresence({
  status,
  viewers,
}: {
  status: ChannelStatus;
  viewers: PresenceEntry[];
}) {
  if (status === "disabled" || status === "connecting") return null;
  const people = uniqueViewers(viewers);
  const live = status === "live";
  return (
    <div className="flex items-center gap-2.5" data-testid="board-presence">
      {live && <AvatarStack people={people} />}
      <span
        role="status"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title={live ? "Changes by others show up as they happen." : undefined}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live ? "bg-emerald-500" : "animate-pulse bg-amber-500",
          )}
        />
        {live ? "Live" : "Reconnecting…"}
      </span>
    </div>
  );
}

/** "Grace is also looking at this task." */
export function TaskViewers({ viewers }: { viewers: PresenceEntry[] }) {
  const people = uniqueViewers(viewers);
  if (people.length === 0) return null;
  const names = people.map((p) => p.name.split(" ")[0] ?? p.name);
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;
  return (
    <div
      role="status"
      className="flex items-center gap-2 text-xs text-muted-foreground"
      data-testid="task-viewers"
    >
      <AvatarStack people={people} max={3} />
      <Eye aria-hidden className="size-3.5" />
      {who} {people.length === 1 ? "is" : "are"} also looking at this task
    </div>
  );
}
