CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"actor_id" text,
	"action" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"task_id" uuid NOT NULL,
	"comment_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_fk" FOREIGN KEY ("task_id","org_id") REFERENCES "public"."tasks"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_fk" FOREIGN KEY ("task_id","org_id") REFERENCES "public"."tasks"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_org_idx" ON "activity_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_project_idx" ON "activity_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_task_idx" ON "activity_log" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_task_idx" ON "comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","org_id","created_at");--> statement-breakpoint
CREATE POLICY "activity_log_select" ON "activity_log" AS PERMISSIVE FOR SELECT TO "app_user" USING ("activity_log"."org_id" = app_current_org_id() and (
        app_is_org_admin("activity_log"."org_id")
        or ("activity_log"."project_id" is not null and app_can_view_project("activity_log"."org_id", "activity_log"."project_id"))
      ));--> statement-breakpoint
CREATE POLICY "activity_log_insert" ON "activity_log" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("activity_log"."org_id" = app_current_org_id() and "activity_log"."actor_id" = app_current_user_id()
        and app_is_member_of("activity_log"."org_id")
        and ("activity_log"."project_id" is null or app_can_view_project("activity_log"."org_id", "activity_log"."project_id")));--> statement-breakpoint
CREATE POLICY "comments_select" ON "comments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("comments"."org_id" = app_current_org_id() and exists (select 1 from tasks where tasks.id = "comments"."task_id"));--> statement-breakpoint
CREATE POLICY "comments_insert" ON "comments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("comments"."org_id" = app_current_org_id() and "comments"."author_id" = app_current_user_id()
        and exists (select 1 from tasks where tasks.id = "comments"."task_id"));--> statement-breakpoint
CREATE POLICY "comments_update" ON "comments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("comments"."org_id" = app_current_org_id() and "comments"."author_id" = app_current_user_id()) WITH CHECK ("comments"."org_id" = app_current_org_id() and "comments"."author_id" = app_current_user_id());--> statement-breakpoint
CREATE POLICY "comments_delete" ON "comments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("comments"."org_id" = app_current_org_id() and exists (select 1 from tasks where tasks.id = "comments"."task_id")
        and ("comments"."author_id" = app_current_user_id() or app_is_org_admin("comments"."org_id")));--> statement-breakpoint
CREATE POLICY "notifications_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("notifications"."org_id" = app_current_org_id() and "notifications"."user_id" = app_current_user_id()
        and exists (select 1 from tasks where tasks.id = "notifications"."task_id"));--> statement-breakpoint
CREATE POLICY "notifications_insert" ON "notifications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("notifications"."org_id" = app_current_org_id() and "notifications"."actor_id" = app_current_user_id()
        and exists (select 1 from tasks where tasks.id = "notifications"."task_id")
        and exists (
          select 1 from member
          where member.user_id = "notifications"."user_id" and member.organization_id = "notifications"."org_id"
        ));--> statement-breakpoint
CREATE POLICY "notifications_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("notifications"."org_id" = app_current_org_id() and "notifications"."user_id" = app_current_user_id()) WITH CHECK ("notifications"."org_id" = app_current_org_id() and "notifications"."user_id" = app_current_user_id());--> statement-breakpoint
CREATE POLICY "notifications_delete" ON "notifications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("notifications"."org_id" = app_current_org_id() and "notifications"."user_id" = app_current_user_id());