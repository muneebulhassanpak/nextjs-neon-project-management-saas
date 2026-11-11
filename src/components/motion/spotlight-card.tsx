"use client";

import { cn } from "@/lib/utils";

/**
 * An `<article>` with a soft light that follows the pointer (`--x`/`--y`, drawn by the
 * `before:` classes). Touch and keyboard users just see the card.
 */
export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "relative isolate",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(260px_circle_at_var(--x,50%)_var(--y,50%),color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]",
        "hover:before:opacity-100",
        className,
      )}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--x", `${String(event.clientX - rect.left)}px`);
        event.currentTarget.style.setProperty("--y", `${String(event.clientY - rect.top)}px`);
      }}
    >
      {children}
    </article>
  );
}
