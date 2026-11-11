/**
 * Database URL helpers shared by the app and drizzle.config.ts (so no `server-only` here).
 */

export const LOCAL_DATABASE_URL = "postgresql://stackboard:stackboard@localhost:5433/stackboard";

// `pg` currently treats these as `verify-full` and warns that they will follow weaker libpq
// semantics in its next major version. Asking for `verify-full` keeps today's strict behaviour.
const WEAK_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/** Makes a connection string (e.g. Neon's, copied as-is) safe and explicit for `pg`. */
export function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && WEAK_SSL_MODES.has(sslmode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

/** Picks the first non-empty URL, falling back to the local Docker database. */
export function resolveDatabaseUrl(...candidates: (string | undefined)[]): string {
  const url = candidates.find((candidate) => candidate?.trim());
  return normalizeDatabaseUrl(url ?? LOCAL_DATABASE_URL);
}
