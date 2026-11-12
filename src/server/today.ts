import "server-only";
import { cookies } from "next/headers";

import { TIME_ZONE_COOKIE, todayIn } from "@/lib/dates";

/** Today in the viewer's time zone (from the cookie TimeZoneCookie sets), else UTC. */
export async function viewerToday(): Promise<string> {
  const zone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return todayIn(zone ? decodeURIComponent(zone) : "UTC");
}
