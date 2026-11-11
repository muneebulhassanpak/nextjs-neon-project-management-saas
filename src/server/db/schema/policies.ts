import { sql } from "drizzle-orm";
import { pgPolicy, pgRole } from "drizzle-orm/pg-core";

import { invitation, member, organization, user } from "./auth";

/**
 * Row-level security policies. The `app_user` role and the app_* functions are created in
 * migration 0001_app_user_role. Queries run as `app_user` only inside withOrgContext().
 *
 * Writes to these auth tables go through Better Auth (as the owner role), so they only need
 * read policies. `account`, `session` and `verification` aren't readable by app_user at all.
 * Tenant tables added later get full read/write policies.
 */
export const appUser = pgRole("app_user").existing();

/** Users see the organizations they belong to. */
export const organizationSelect = pgPolicy("organization_select_own", {
  for: "select",
  to: appUser,
  using: sql`app_is_member_of(${organization.id})`,
}).link(organization);

/** Users see their own memberships, and the members of the organization they're working in. */
export const memberSelect = pgPolicy("member_select_own_or_current_org", {
  for: "select",
  to: appUser,
  using: sql`${member.userId} = app_current_user_id()
    or (${member.organizationId} = app_current_org_id() and app_is_member_of(${member.organizationId}))`,
}).link(member);

/** Pending invitations are visible inside the organization they belong to. */
export const invitationSelect = pgPolicy("invitation_select_current_org", {
  for: "select",
  to: appUser,
  using: sql`${invitation.organizationId} = app_current_org_id()
    and app_is_member_of(${invitation.organizationId})`,
}).link(invitation);

/** Users see themselves and the people in the organization they're working in. */
export const userSelect = pgPolicy("user_select_self_or_current_org", {
  for: "select",
  to: appUser,
  using: sql`${user.id} = app_current_user_id()
    or exists (
      select 1 from member
      where member.user_id = ${user.id} and member.organization_id = app_current_org_id()
    )`,
}).link(user);
