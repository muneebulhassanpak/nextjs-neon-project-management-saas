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
