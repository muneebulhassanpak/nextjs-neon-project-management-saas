"use client";

import { useEffect } from "react";

import { TIME_ZONE_COOKIE } from "@/lib/dates";

/**
 * Tells the server the viewer's time zone, so "today", "overdue" and "due this week" match the
 * viewer's calendar rather than the server's (UTC). The first visit falls back to UTC.
 */
export function TimeZoneCookie() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const value = encodeURIComponent(zone);
    if (document.cookie.split("; ").includes(`${TIME_ZONE_COOKIE}=${value}`)) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}
