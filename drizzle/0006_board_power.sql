CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_comment_id_user_id_emoji_pk" PRIMARY KEY("comment_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_task_fk" FOREIGN KEY ("task_id","org_id") REFERENCES "public"."tasks"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_items_task_idx" ON "checklist_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "comment_reactions_comment_idx" ON "comment_reactions" USING btree ("comment_id");--> statement-breakpoint
CREATE POLICY "checklist_items_select" ON "checklist_items" AS PERMISSIVE FOR SELECT TO "app_user" USING ("checklist_items"."org_id" = app_current_org_id() and exists (select 1 from tasks where tasks.id = "checklist_items"."task_id"));--> statement-breakpoint
CREATE POLICY "checklist_items_insert" ON "checklist_items" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("checklist_items"."org_id" = app_current_org_id() and exists (
      select 1 from tasks where tasks.id = "checklist_items"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
    ));--> statement-breakpoint
CREATE POLICY "checklist_items_update" ON "checklist_items" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("checklist_items"."org_id" = app_current_org_id() and exists (
      select 1 from tasks where tasks.id = "checklist_items"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
    )) WITH CHECK ("checklist_items"."org_id" = app_current_org_id() and exists (
      select 1 from tasks where tasks.id = "checklist_items"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
    ));--> statement-breakpoint
CREATE POLICY "checklist_items_delete" ON "checklist_items" AS PERMISSIVE FOR DELETE TO "app_user" USING ("checklist_items"."org_id" = app_current_org_id() and exists (
      select 1 from tasks where tasks.id = "checklist_items"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
    ));--> statement-breakpoint
CREATE POLICY "comment_reactions_select" ON "comment_reactions" AS PERMISSIVE FOR SELECT TO "app_user" USING ("comment_reactions"."org_id" = app_current_org_id() and exists (select 1 from comments where comments.id = "comment_reactions"."comment_id"));--> statement-breakpoint
CREATE POLICY "comment_reactions_insert" ON "comment_reactions" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("comment_reactions"."org_id" = app_current_org_id() and "comment_reactions"."user_id" = app_current_user_id()
        and exists (select 1 from comments where comments.id = "comment_reactions"."comment_id"));--> statement-breakpoint
CREATE POLICY "comment_reactions_delete" ON "comment_reactions" AS PERMISSIVE FOR DELETE TO "app_user" USING ("comment_reactions"."org_id" = app_current_org_id() and "comment_reactions"."user_id" = app_current_user_id());