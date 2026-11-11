import "server-only";

import type { SocialProvider } from "@/components/auth/social-buttons";
import { env } from "@/env";

/** The social providers with credentials configured, so the UI only shows working buttons. */
export function enabledSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push("github");
  return providers;
}
