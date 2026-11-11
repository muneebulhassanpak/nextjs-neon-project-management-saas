import { Pool } from "pg";

import { E2E_DATABASE_URL } from "../../playwright.config";

/**
 * Direct database access for things a test can't do through the UI, like clicking the link
 * in a verification email (emails only go to the server log in tests).
 */
const pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 2 });

export async function markEmailVerified(email: string): Promise<void> {
  await pool.query(`update "user" set email_verified = true where email = $1`, [email]);
}

export async function pendingInvitationId(email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `select id from invitation where email = $1 and status = 'pending' order by created_at desc limit 1`,
    [email],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`No pending invitation for ${email}`);
  return id;
}
