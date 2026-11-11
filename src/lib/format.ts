const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** "Nov 11, 2026". Formatted in UTC so server and browser render the same text. */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 6 days", "tomorrow". */
export function formatRelativeDays(date: Date, now: Date = new Date()): string {
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  return relative.format(days, "day");
}

const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago", then "Nov 3". For feeds. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return shortDate.format(date);
}

export type CountFormat = "number" | "percent" | "duration";

/** A count-up frame: `value` rounded, as a number, a percentage or minutes ("32h 10m"). */
export function formatCount(value: number, format: CountFormat = "number"): string {
  const n = Math.round(value);
  if (format === "percent") return `${String(n)}%`;
  if (format === "duration") return `${String(Math.floor(n / 60))}h ${String(n % 60)}m`;
  return String(n);
}
