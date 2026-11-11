-- Row-level security foundation.
--
-- The app talks to Postgres as the database owner, which bypasses RLS. Tenant-scoped
-- queries run inside withOrgContext(), which switches to the `app_user` role for one
-- transaction and sets who the user is and which organization they're working in.
-- Policies on each table read those settings through the functions below.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
-- Lets the connecting role `SET ROLE app_user`.
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--> statement-breakpoint
-- Auth internals (password hashes, session tokens) are never read as app_user.
REVOKE ALL ON account, session, verification, rate_limit FROM app_user;
--> statement-breakpoint
-- Tables created by later migrations get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.current_user_id', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.current_org_id', true), '') $$;
--> statement-breakpoint
-- SECURITY DEFINER so policies on `member` can call it without recursing into themselves.
CREATE OR REPLACE FUNCTION app_is_member_of(org_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM member
      WHERE member.organization_id = org_id AND member.user_id = app_current_user_id()
    )
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_is_member_of(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_member_of(text) TO app_user;
