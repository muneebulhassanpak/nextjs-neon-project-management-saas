import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** The rounded "pill" call-to-action used across the landing page. */
export function PillLink({
  href,
  children,
  variant = "solid",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-10 items-center gap-2 rounded-full pr-1.5 pl-5 text-sm font-medium transition-[color,background-color,scale] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100",
        variant === "solid"
          ? "bg-foreground text-background hover:bg-foreground/85"
          : "border bg-background/60 text-foreground backdrop-blur hover:bg-muted",
        className,
      )}
    >
      {children}
      {/* On hover the arrow slides out to the right and a new one slides in from the left. */}
      <span
        className={cn(
          "relative flex size-7 items-center justify-center overflow-hidden rounded-full",
          variant === "solid" ? "bg-background text-foreground" : "bg-foreground text-background",
        )}
      >
        <ArrowRight
          className="size-3.5 transition-transform duration-300 ease-smooth group-hover:translate-x-6 motion-reduce:transition-none"
          aria-hidden
        />
        <ArrowRight
          className="absolute size-3.5 -translate-x-6 transition-transform duration-300 ease-smooth group-hover:translate-x-0 motion-reduce:transition-none"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "lp-reveal flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "items-start",
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description && (
        <p className="max-w-xl text-base text-pretty text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** A floating "product UI" card for the illustrations. */
export function MockCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/90 p-4 text-card-foreground shadow-lg shadow-black/[0.04] backdrop-blur dark:shadow-black/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
];

/** Initials avatar for illustrations: no stock photos of people who don't use the product. */
export function FakeAvatar({
  name,
  className,
  color = 0,
  style,
}: {
  name: string;
  className?: string;
  color?: number;
  style?: React.CSSProperties;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      style={style}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold ring-2 ring-card",
        AVATAR_COLORS[color % AVATAR_COLORS.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Soft warm glow behind a section. Purely decorative. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10",
        className,
      )}
    />
  );
}
