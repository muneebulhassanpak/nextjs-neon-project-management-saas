/** Today's date (YYYY-MM-DD) in a time zone. An unknown zone falls back to UTC. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** A YYYY-MM-DD date moved by `days` (negative goes back). */
export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The cookie that tells the server the viewer's time zone. */
export const TIME_ZONE_COOKIE = "tz";
