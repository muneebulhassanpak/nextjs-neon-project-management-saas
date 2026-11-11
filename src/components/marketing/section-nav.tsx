"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** The header's section links, with the section in view highlighted. */
export function SectionNav({ links }: { links: { href: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = links
      .map((link) => document.getElementById(link.href.replace("/#", "")))
      .filter((section) => section !== null);
    if (sections.length === 0) return;
    // A section counts as "in view" while it crosses the middle of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
          else setActive((current) => (current === entry.target.id ? null : current));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, [links]);

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {links.map((link) => {
        const current = link.href === `/#${active ?? ""}`;
        return (
          <a
            key={link.href}
            href={link.href}
            aria-current={current ? "location" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground",
              current && "bg-muted text-foreground",
            )}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
