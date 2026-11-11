ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invitation_select_current_org" ON "invitation" AS PERMISSIVE FOR SELECT TO "app_user" USING ("invitation"."organization_id" = app_current_org_id()
    and app_is_member_of("invitation"."organization_id"));--> statement-breakpoint
CREATE POLICY "member_select_own_or_current_org" ON "member" AS PERMISSIVE FOR SELECT TO "app_user" USING ("member"."user_id" = app_current_user_id()
    or ("member"."organization_id" = app_current_org_id() and app_is_member_of("member"."organization_id")));--> statement-breakpoint
CREATE POLICY "organization_select_own" ON "organization" AS PERMISSIVE FOR SELECT TO "app_user" USING (app_is_member_of("organization"."id"));--> statement-breakpoint
CREATE POLICY "user_select_self_or_current_org" ON "user" AS PERMISSIVE FOR SELECT TO "app_user" USING ("user"."id" = app_current_user_id()
    or exists (
      select 1 from member
      where member.user_id = "user"."id" and member.organization_id = app_current_org_id()
    ));