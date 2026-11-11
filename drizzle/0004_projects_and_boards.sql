CREATE TYPE "public"."project_status" AS ENUM('active', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('none', 'low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_columns_id_project_unique" UNIQUE("id","project_id")
);
--> statement-breakpoint
ALTER TABLE "board_columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_id_org_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"created_by" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_id_org_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_labels" (
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	CONSTRAINT "task_labels_task_id_label_id_pk" PRIMARY KEY("task_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "task_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"assignee_id" text,
	"priority" "task_priority" DEFAULT 'none' NOT NULL,
	"due_date" date,
	"position" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_id_org_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_project_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_fk" FOREIGN KEY ("task_id","org_id") REFERENCES "public"."tasks"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_fk" FOREIGN KEY ("label_id","org_id") REFERENCES "public"."labels"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_fk" FOREIGN KEY ("column_id","project_id") REFERENCES "public"."board_columns"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_columns_project_idx" ON "board_columns" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_org_name_uidx" ON "labels" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_org_idx" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "task_labels_label_idx" ON "task_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "tasks_column_idx" ON "tasks" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE POLICY "board_columns_select" ON "board_columns" AS PERMISSIVE FOR SELECT TO "app_user" USING ("board_columns"."org_id" = app_current_org_id() and app_can_view_project("board_columns"."org_id", "board_columns"."project_id"));--> statement-breakpoint
CREATE POLICY "board_columns_insert" ON "board_columns" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("board_columns"."org_id" = app_current_org_id() and app_can_edit_project("board_columns"."org_id", "board_columns"."project_id"));--> statement-breakpoint
CREATE POLICY "board_columns_update" ON "board_columns" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("board_columns"."org_id" = app_current_org_id() and app_can_edit_project("board_columns"."org_id", "board_columns"."project_id")) WITH CHECK ("board_columns"."org_id" = app_current_org_id() and app_can_edit_project("board_columns"."org_id", "board_columns"."project_id"));--> statement-breakpoint
CREATE POLICY "board_columns_delete" ON "board_columns" AS PERMISSIVE FOR DELETE TO "app_user" USING ("board_columns"."org_id" = app_current_org_id() and app_can_edit_project("board_columns"."org_id", "board_columns"."project_id"));--> statement-breakpoint
CREATE POLICY "labels_select" ON "labels" AS PERMISSIVE FOR SELECT TO "app_user" USING ("labels"."org_id" = app_current_org_id() and app_is_member_of("labels"."org_id"));--> statement-breakpoint
CREATE POLICY "labels_insert" ON "labels" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("labels"."org_id" = app_current_org_id() and app_can_edit_tasks_in("labels"."org_id"));--> statement-breakpoint
CREATE POLICY "labels_update" ON "labels" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("labels"."org_id" = app_current_org_id() and app_is_org_admin("labels"."org_id")) WITH CHECK ("labels"."org_id" = app_current_org_id() and app_is_org_admin("labels"."org_id"));--> statement-breakpoint
CREATE POLICY "labels_delete" ON "labels" AS PERMISSIVE FOR DELETE TO "app_user" USING ("labels"."org_id" = app_current_org_id() and app_is_org_admin("labels"."org_id"));--> statement-breakpoint
CREATE POLICY "project_members_select" ON "project_members" AS PERMISSIVE FOR SELECT TO "app_user" USING ("project_members"."org_id" = app_current_org_id() and app_can_view_project("project_members"."org_id", "project_members"."project_id"));--> statement-breakpoint
CREATE POLICY "project_members_insert" ON "project_members" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("project_members"."org_id" = app_current_org_id() and app_is_org_admin("project_members"."org_id"));--> statement-breakpoint
CREATE POLICY "project_members_delete" ON "project_members" AS PERMISSIVE FOR DELETE TO "app_user" USING ("project_members"."org_id" = app_current_org_id() and app_is_org_admin("project_members"."org_id"));--> statement-breakpoint
CREATE POLICY "projects_select" ON "projects" AS PERMISSIVE FOR SELECT TO "app_user" USING ("projects"."org_id" = app_current_org_id() and app_can_view_project("projects"."org_id", "projects"."id"));--> statement-breakpoint
CREATE POLICY "projects_insert" ON "projects" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("projects"."org_id" = app_current_org_id() and app_is_org_admin("projects"."org_id"));--> statement-breakpoint
CREATE POLICY "projects_update" ON "projects" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("projects"."org_id" = app_current_org_id() and app_is_org_admin("projects"."org_id")) WITH CHECK ("projects"."org_id" = app_current_org_id() and app_is_org_admin("projects"."org_id"));--> statement-breakpoint
CREATE POLICY "projects_delete" ON "projects" AS PERMISSIVE FOR DELETE TO "app_user" USING ("projects"."org_id" = app_current_org_id() and app_is_org_admin("projects"."org_id"));--> statement-breakpoint
CREATE POLICY "task_labels_select" ON "task_labels" AS PERMISSIVE FOR SELECT TO "app_user" USING ("task_labels"."org_id" = app_current_org_id() and exists (select 1 from tasks where tasks.id = "task_labels"."task_id"));--> statement-breakpoint
CREATE POLICY "task_labels_insert" ON "task_labels" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("task_labels"."org_id" = app_current_org_id() and exists (
        select 1 from tasks where tasks.id = "task_labels"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
      ));--> statement-breakpoint
CREATE POLICY "task_labels_delete" ON "task_labels" AS PERMISSIVE FOR DELETE TO "app_user" USING ("task_labels"."org_id" = app_current_org_id() and exists (
        select 1 from tasks where tasks.id = "task_labels"."task_id" and app_can_edit_project(tasks.org_id, tasks.project_id)
      ));--> statement-breakpoint
CREATE POLICY "tasks_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_user" USING ("tasks"."org_id" = app_current_org_id() and app_can_view_project("tasks"."org_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("tasks"."org_id" = app_current_org_id() and app_can_edit_project("tasks"."org_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("tasks"."org_id" = app_current_org_id() and app_can_edit_project("tasks"."org_id", "tasks"."project_id")) WITH CHECK ("tasks"."org_id" = app_current_org_id() and app_can_edit_project("tasks"."org_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_delete" ON "tasks" AS PERMISSIVE FOR DELETE TO "app_user" USING ("tasks"."org_id" = app_current_org_id() and app_can_edit_project("tasks"."org_id", "tasks"."project_id")
        and (app_is_org_admin("tasks"."org_id") or "tasks"."created_by" = app_current_user_id()));