import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { ActivityAction } from "@/lib/activity";
import type { Reaction } from "@/lib/reactions";

import { organization, user } from "./auth";
import { appUser } from "./policies";
import { projects, tasks } from "./projects";

/*
 * Comments, the activity log and in-app notifications. Like the board tables, every row carries
 * `org_id` and references its task or project through keys that include it.
 *
 * Comments and notifications follow the task: the `exists (select 1 from tasks ...)` checks run
 * under the tasks policies, so a row is only visible while its task is.
 */

const inCurrentOrg = (orgId: unknown) => sql`${orgId} = app_current_org_id()`;
const taskVisible = (taskId: unknown) =>
  sql`exists (select 1 from tasks where tasks.id = ${taskId})`;
const commentVisible = (commentId: unknown) =>
  sql`exists (select 1 from comments where comments.id = ${commentId})`;

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    taskId: uuid("task_id").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    /** Plain text with `<@userId>` mention tokens. See src/lib/mentions.ts. */
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "comments_task_fk",
      columns: [t.taskId, t.orgId],
      foreignColumns: [tasks.id, tasks.orgId],
    }).onDelete("cascade"),
    index("comments_task_idx").on(t.taskId, t.createdAt),
    pgPolicy("comments_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${taskVisible(t.taskId)}`,
    }),
    // Everyone who can see a task can discuss it (clients only on shared tasks, in Phase 5).
    pgPolicy("comments_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.authorId} = app_current_user_id()
        and ${taskVisible(t.taskId)}`,
    }),
    pgPolicy("comments_update", {
      for: "update",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${t.authorId} = app_current_user_id()`,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.authorId} = app_current_user_id()`,
    }),
    // Authors delete their own comments; owners and admins can remove any.
    pgPolicy("comments_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${taskVisible(t.taskId)}
        and (${t.authorId} = app_current_user_id() or app_is_org_admin(${t.orgId}))`,
    }),
  ],
);

/** Emoji reactions on comments: one row per person and emoji. Visible with the comment. */
export const commentReactions = pgTable(
  "comment_reactions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    emoji: text("emoji").$type<Reaction>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId, t.emoji] }),
    index("comment_reactions_comment_idx").on(t.commentId),
    pgPolicy("comment_reactions_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${commentVisible(t.commentId)}`,
    }),
    pgPolicy("comment_reactions_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()
        and ${commentVisible(t.commentId)}`,
    }),
    pgPolicy("comment_reactions_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()`,
    }),
  ],
);

/**
 * Who did what, when. Rows are only ever added (no update or delete policies). Task rows keep
 * their `task_id` after the task is deleted, so the history stays readable.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Null for organization-wide events (e.g. someone joined). */
    projectId: uuid("project_id"),
    taskId: uuid("task_id"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").$type<ActivityAction>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    // Not now(): that's the transaction's start, so one save's entries would all tie.
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "activity_log_project_fk",
      columns: [t.projectId, t.orgId],
      foreignColumns: [projects.id, projects.orgId],
    }).onDelete("cascade"),
    index("activity_log_org_idx").on(t.orgId, t.createdAt),
    index("activity_log_project_idx").on(t.projectId, t.createdAt),
    index("activity_log_task_idx").on(t.taskId, t.createdAt),
    // Owners and admins see everything; members see the projects they're on; clients nothing.
    pgPolicy("activity_log_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and (
        app_is_org_admin(${t.orgId})
        or (${t.projectId} is not null and app_can_view_project(${t.orgId}, ${t.projectId}))
      )`,
    }),
    // People record their own actions, in projects they can see.
    pgPolicy("activity_log_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.actorId} = app_current_user_id()
        and app_is_member_of(${t.orgId})
        and (${t.projectId} is null or app_can_view_project(${t.orgId}, ${t.projectId}))`,
    }),
  ],
);

/** In-app notifications. Each person sees, reads and clears only their own. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").$type<"mention" | "assigned">().notNull(),
    taskId: uuid("task_id").notNull(),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: "notifications_task_fk",
      columns: [t.taskId, t.orgId],
      foreignColumns: [tasks.id, tasks.orgId],
    }).onDelete("cascade"),
    index("notifications_user_idx").on(t.userId, t.orgId, t.createdAt),
    // Hidden once the task isn't visible to the recipient (e.g. removed from the project).
    pgPolicy("notifications_select", {
      for: "select",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()
        and ${taskVisible(t.taskId)}`,
    }),
    // Sent by the person acting, about a task they can see, to someone in the organization.
    pgPolicy("notifications_insert", {
      for: "insert",
      to: appUser,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.actorId} = app_current_user_id()
        and ${taskVisible(t.taskId)}
        and exists (
          select 1 from member
          where member.user_id = ${t.userId} and member.organization_id = ${t.orgId}
        )`,
    }),
    pgPolicy("notifications_update", {
      for: "update",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()`,
      withCheck: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()`,
    }),
    pgPolicy("notifications_delete", {
      for: "delete",
      to: appUser,
      using: sql`${inCurrentOrg(t.orgId)} and ${t.userId} = app_current_user_id()`,
    }),
  ],
);

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(user, { fields: [comments.authorId], references: [user.id] }),
}));
