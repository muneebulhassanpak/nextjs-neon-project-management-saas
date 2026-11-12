import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { PROJECT_STATUSES, TASK_PRIORITIES, type TaskDescription } from "@/lib/projects";

import { organization, user } from "./auth";
import { appUser } from "./policies";

/*
 * Projects and their boards. Every table carries `org_id`, and child rows reference their
 * parent through composite keys that include it (e.g. a task's `(project_id, org_id)`), so a row
 * can never point into another organization.
 *
 * Access is enforced by row-level security, using the functions in migration
 * 0003_project_access_functions:
 *   app_is_org_admin(org)        owner or admin of the organization
 *   app_can_view_project(org, id)  admins see every project; members see the ones they're on
 *   app_can_edit_project(org, id)  same as view for now; clients will view without editing (Phase 5)
 */

export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES);

const inCurrentOrg = (orgId: unknown) => sql`${orgId} = app_current_org_id()`;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatus("status").default("active").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("projects_id_org_unique").on(t.id, t.orgId),
    index("projects_org_idx").on(t.orgId),
    pgPolicy("projects_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_can_view_project(${t.orgId}, ${t.id})`,
    }),
    pgPolicy("projects_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
    pgPolicy("projects_update", {
      for: "update",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
    pgPolicy("projects_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
  ],
);

/** Members assigned to a project. Owners and admins see every project without a row here. */
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull(),
    orgId: text("org_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    foreignKey({
      name: "project_members_project_fk",
      columns: [t.projectId, t.orgId],
      foreignColumns: [projects.id, projects.orgId],
    }).onDelete("cascade"),
    index("project_members_user_idx").on(t.userId),
    pgPolicy("project_members_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_can_view_project(${t.orgId}, ${t.projectId})`,
    }),
    pgPolicy("project_members_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
    pgPolicy("project_members_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
  ],
);

export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    /** Fractional index; compare with `collate "C"`. See src/lib/positions.ts. */
    position: text("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("board_columns_id_project_unique").on(t.id, t.projectId),
    foreignKey({
      name: "board_columns_project_fk",
      columns: [t.projectId, t.orgId],
      foreignColumns: [projects.id, projects.orgId],
    }).onDelete("cascade"),
    index("board_columns_project_idx").on(t.projectId),
    ...editableByProject("board_columns", t.orgId, t.projectId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    columnId: uuid("column_id").notNull(),
    title: text("title").notNull(),
    description: jsonb("description").$type<TaskDescription>(),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    priority: taskPriority("priority").default("none").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    /** Fractional index within the column; compare with `collate "C"`. */
    position: text("position").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("tasks_id_org_unique").on(t.id, t.orgId),
    foreignKey({
      name: "tasks_project_fk",
      columns: [t.projectId, t.orgId],
      foreignColumns: [projects.id, projects.orgId],
    }).onDelete("cascade"),
    // The column must belong to the same project. Deleting a column with tasks is refused;
    // the app moves its tasks first.
    foreignKey({
      name: "tasks_column_fk",
      columns: [t.columnId, t.projectId],
      foreignColumns: [boardColumns.id, boardColumns.projectId],
    }),
    index("tasks_column_idx").on(t.columnId),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_assignee_idx").on(t.assigneeId),
    pgPolicy("tasks_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_can_view_project(${t.orgId}, ${t.projectId})`,
    }),
    pgPolicy("tasks_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_can_edit_project(${t.orgId}, ${t.projectId})`,
    }),
    pgPolicy("tasks_update", {
      for: "update",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_can_edit_project(${t.orgId}, ${t.projectId})`,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_can_edit_project(${t.orgId}, ${t.projectId})`,
    }),
    // Admins delete any task; members only the ones they created.
    pgPolicy("tasks_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_can_edit_project(${t.orgId}, ${t.projectId})
        and (app_is_org_admin(${t.orgId}) or ${t.createdBy} = app_current_user_id())`,
    }),
  ],
);

/** Labels are shared across the organization's projects. */
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("labels_id_org_unique").on(t.id, t.orgId),
    uniqueIndex("labels_org_name_uidx").on(t.orgId, sql`lower(${t.name})`),
    pgPolicy("labels_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_member_of(${t.orgId})`,
    }),
    // Anyone who works on tasks can create labels; only admins rename or delete them.
    pgPolicy("labels_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_can_edit_tasks_in(${t.orgId})`,
    }),
    pgPolicy("labels_update", {
      for: "update",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
      withCheck: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
    pgPolicy("labels_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and app_is_org_admin(${t.orgId})`,
    }),
  ],
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id").notNull(),
    labelId: uuid("label_id").notNull(),
    orgId: text("org_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.labelId] }),
    foreignKey({
      name: "task_labels_task_fk",
      columns: [t.taskId, t.orgId],
      foreignColumns: [tasks.id, tasks.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "task_labels_label_fk",
      columns: [t.labelId, t.orgId],
      foreignColumns: [labels.id, labels.orgId],
    }).onDelete("cascade"),
    index("task_labels_label_idx").on(t.labelId),
    // Visible and editable exactly when the task is: the subquery runs under the tasks policies.
    pgPolicy("task_labels_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and exists (select 1 from tasks where tasks.id = ${t.taskId})`,
    }),
    pgPolicy("task_labels_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and exists (
        select 1 from tasks where tasks.id = ${t.taskId} and app_can_edit_project(tasks.org_id, tasks.project_id)
      )`,
    }),
    pgPolicy("task_labels_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and exists (
        select 1 from tasks where tasks.id = ${t.taskId} and app_can_edit_project(tasks.org_id, tasks.project_id)
      )`,
    }),
  ],
);

/**
 * A task's checklist (its subtasks). Visible with the task, and editable by anyone who can edit
 * the task's project: the subqueries run under the tasks policies.
 */
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    taskId: uuid("task_id").notNull(),
    title: text("title").notNull(),
    done: boolean("done").default(false).notNull(),
    /** Fractional index within the checklist; compare with `collate "C"`. */
    position: text("position").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => {
    const taskEditable = sql`${inCurrentOrg(t.orgId)} and exists (
      select 1 from tasks where tasks.id = ${t.taskId} and app_can_edit_project(tasks.org_id, tasks.project_id)
    )`;
    return [
      foreignKey({
        name: "checklist_items_task_fk",
        columns: [t.taskId, t.orgId],
        foreignColumns: [tasks.id, tasks.orgId],
      }).onDelete("cascade"),
      index("checklist_items_task_idx").on(t.taskId),
      pgPolicy("checklist_items_select", {
        for: "select",
        to: appUser,
        using: sql`${inCurrentOrg(t.orgId)} and exists (select 1 from tasks where tasks.id = ${t.taskId})`,
      }),
      pgPolicy("checklist_items_insert", { for: "insert", to: appUser, withCheck: taskEditable }),
      pgPolicy("checklist_items_update", {
        for: "update",
        to: appUser,
        using: taskEditable,
        withCheck: taskEditable,
      }),
      pgPolicy("checklist_items_delete", { for: "delete", to: appUser, using: taskEditable }),
    ];
  },
);

/** Select/insert/update/delete policies for a table whose rows belong to one project. */
function editableByProject(table: string, orgId: unknown, projectId: unknown) {
  const canView = sql`${inCurrentOrg(orgId)} and app_can_view_project(${orgId}, ${projectId})`;
  const canEdit = sql`${inCurrentOrg(orgId)} and app_can_edit_project(${orgId}, ${projectId})`;
  return [
    pgPolicy(`${table}_select`, { for: "select", to: appUser, using: canView }),
    pgPolicy(`${table}_insert`, { for: "insert", to: appUser, withCheck: canEdit }),
    pgPolicy(`${table}_update`, { for: "update", to: appUser, using: canEdit, withCheck: canEdit }),
    pgPolicy(`${table}_delete`, { for: "delete", to: appUser, using: canEdit }),
  ];
}

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  columns: many(boardColumns),
  tasks: many(tasks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(user, { fields: [projectMembers.userId], references: [user.id] }),
}));

export const boardColumnsRelations = relations(boardColumns, ({ one, many }) => ({
  project: one(projects, { fields: [boardColumns.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  column: one(boardColumns, { fields: [tasks.columnId], references: [boardColumns.id] }),
  assignee: one(user, { fields: [tasks.assigneeId], references: [user.id] }),
  labels: many(taskLabels),
}));

export const labelsRelations = relations(labels, ({ many }) => ({
  tasks: many(taskLabels),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}));
