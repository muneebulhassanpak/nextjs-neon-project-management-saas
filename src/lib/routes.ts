/** Paths anyone can open. Everything else needs a session (checked in `src/proxy.ts`). */
export const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];
export const PUBLIC_PREFIXES = ["/api/", "/invitations/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Where users land after signing in. Resolves to their organization or onboarding. */
export const AFTER_SIGN_IN_PATH = "/dashboard";

/**
 * Top-level paths that can't be organization slugs, because `/[orgSlug]` shares the root.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "app",
  "dashboard",
  "onboarding",
  "invitations",
  "sign-in",
  "sign-up",
  "sign-out",
  "forgot-password",
  "reset-password",
  "settings",
  "account",
  "admin",
  "pricing",
  "about",
  "blog",
  "docs",
  "help",
  "legal",
  "privacy",
  "terms",
  "_next",
]);

/** Only allow same-site relative redirects, so `?next=` can't send users to another site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return AFTER_SIGN_IN_PATH;
  }
  return next;
}
