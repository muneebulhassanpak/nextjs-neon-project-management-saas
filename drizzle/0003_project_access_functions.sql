-- Access checks for project data, used by the row-level security policies on projects,
-- project_members, board_columns, tasks, labels and task_labels (migration 0004).
--
-- SECURITY DEFINER so they can read `member` and `project_members` without recursing into
-- those tables' own policies. The project checks take the row's org id rather than looking the
-- project up: a row being inserted isn't visible to a lookup yet, and INSERT ... RETURNING is
-- checked against the select policy too. They're PL/pgSQL because project_members is created
-- by the next migration (PL/pgSQL bodies are checked when they run).

CREATE OR REPLACE FUNCTION app_org_role(org_id text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT member.role FROM member
    WHERE member.organization_id = org_id AND member.user_id = app_current_user_id()
  $$;
--> statement-breakpoint
-- Owners and admins: manage projects, see all of them, rename and delete labels.
CREATE OR REPLACE FUNCTION app_is_org_admin(org_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT coalesce(app_org_role(org_id) IN ('owner', 'admin'), false) $$;
--> statement-breakpoint
-- Everyone who works on tasks (not clients): may create labels.
CREATE OR REPLACE FUNCTION app_can_edit_tasks_in(org_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT coalesce(app_org_role(org_id) IN ('owner', 'admin', 'member'), false) $$;
--> statement-breakpoint
-- Owners and admins see every project of the organization; members see the projects they're
-- assigned to. p_org_id must be the project's own org_id (callers pass the row's column).
-- Clients see none yet (the client portal arrives in Phase 4).
CREATE OR REPLACE FUNCTION app_can_view_project(p_org_id text, p_project_id uuid) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_role text := app_org_role(p_org_id);
  BEGIN
    IF v_role IN ('owner', 'admin') THEN
      RETURN true;
    END IF;
    IF v_role = 'member' THEN
      RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = p_project_id
          AND project_members.user_id = app_current_user_id()
      );
    END IF;
    RETURN false;
  END
  $$;
--> statement-breakpoint
-- Who may change a project's columns and tasks. The same people as view for now; clients will
-- be able to view their projects without editing them.
CREATE OR REPLACE FUNCTION app_can_edit_project(p_org_id text, p_project_id uuid) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_role text := app_org_role(p_org_id);
  BEGIN
    IF v_role IN ('owner', 'admin') THEN
      RETURN true;
    END IF;
    IF v_role = 'member' THEN
      RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = p_project_id
          AND project_members.user_id = app_current_user_id()
      );
    END IF;
    RETURN false;
  END
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_org_role(text), app_is_org_admin(text), app_can_edit_tasks_in(text),
  app_can_view_project(text, uuid), app_can_edit_project(text, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_org_role(text), app_is_org_admin(text), app_can_edit_tasks_in(text),
  app_can_view_project(text, uuid), app_can_edit_project(text, uuid) TO app_user;
