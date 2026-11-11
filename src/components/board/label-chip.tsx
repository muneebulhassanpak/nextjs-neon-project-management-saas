import type { LabelColor } from "@/lib/projects";
import { cn } from "@/lib/utils";

/** Dot colours for labels. Listed in full so Tailwind keeps the classes. */
const DOT: Record<LabelColor, string> = {
  gray: "bg-zinc-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function labelDot(color: string): string {
  return color in DOT ? DOT[color as LabelColor] : DOT.gray;
}

export function LabelChip({
  label,
  className,
}: {
  label: { name: string; color: string };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", labelDot(label.color))} aria-hidden />
      <span className="truncate">{label.name}</span>
    </span>
  );
}
