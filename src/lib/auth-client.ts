import { magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "@/lib/roles";

/** Browser-side auth client. Calls go to /api/auth on the current origin. */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient({ ac, roles })],
});
