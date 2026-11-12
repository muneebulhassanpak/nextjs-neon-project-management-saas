import { cn } from "@/lib/utils";

/** A thin done-of-total bar. The track is a lighter step of the fill's own colour. */
export function ProgressMeter({
  done,
  total,
  label,
  className,
}: {
  done: number;
  total: number;
  label: string;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} done`}
      className={cn("h-1.5 overflow-hidden rounded-full bg-primary/15", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-smooth"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
