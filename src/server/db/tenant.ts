import "server-only";
import { sql } from "drizzle-orm";

import { db } from "./client";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TenantContext {
  userId: string;
  /** The organization being worked in. `null` outside an organization (e.g. onboarding). */
  orgId: string | null;
}

/**
 * Runs `fn` in a transaction as the `app_user` role, so row-level security applies to every
 * query in it. Postgres, not application code, decides which rows the user can see.
 * Every tenant-scoped query must go through here.
 */
export function withOrgContext<T>(
  context: TenantContext,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // `true` = local to this transaction, so settings never leak to the next pooled request.
    await tx.execute(
      sql`select set_config('app.current_user_id', ${context.userId}, true),
                 set_config('app.current_org_id', ${context.orgId ?? ""}, true)`,
    );
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}
