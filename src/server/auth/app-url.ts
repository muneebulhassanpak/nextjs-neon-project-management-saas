/**
 * The public URL of this deployment, used for auth callbacks and links in emails.
 * Order: BETTER_AUTH_URL, then Vercel's production / branch / deployment URL, then local.
 */
export function resolveAppUrl(vars: NodeJS.ProcessEnv = process.env): string {
  if (vars.BETTER_AUTH_URL) return vars.BETTER_AUTH_URL;
  if (vars.VERCEL_ENV === "production" && vars.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${vars.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (vars.VERCEL_BRANCH_URL) return `https://${vars.VERCEL_BRANCH_URL}`;
  if (vars.VERCEL_URL) return `https://${vars.VERCEL_URL}`;
  return vars.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Every URL this deployment can be reached on, so auth accepts requests from each of them. */
export function resolveTrustedOrigins(vars: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = [vars.VERCEL_PROJECT_PRODUCTION_URL, vars.VERCEL_BRANCH_URL, vars.VERCEL_URL];
  const origins = hosts
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
  return [...new Set([resolveAppUrl(vars), ...origins])];
}
