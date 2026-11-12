import { z } from "zod";

/** Shared by forms, Server Actions and the database schema. */

export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const TASK_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Columns every new project starts with. They can be renamed, reordered and deleted. */
export const DEFAULT_COLUMNS = ["To do", "In progress", "Review", "Done"] as const;

export const LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const projectNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(80, "Use at most 80 characters.");

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Use at most 500 characters.")
  .transform((value) => (value === "" ? null : value));

export const columnNameSchema = z
  .string()
  .trim()
  .min(1, "Give the column a name.")
  .max(40, "Use at most 40 characters.");

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the task a title.")
  .max(200, "Use at most 200 characters.");

export const checklistItemSchema = z
  .string()
  .trim()
  .min(1, "Write the item first.")
  .max(200, "Keep checklist items under 200 characters.");

export const labelNameSchema = z
  .string()
  .trim()
  .min(1, "Give the label a name.")
  .max(30, "Use at most 30 characters.");

/** A due date as `YYYY-MM-DD`, or null to clear it. */
export const dueDateSchema = z.iso.date("Pick a valid date.").nullable();

/**
 * A rich text description: the editor's JSON document. Only its shape and size are checked
 * here; it's rendered by the editor, which drops anything outside its schema, never as raw HTML.
 */
export const taskDescriptionSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .loose()
  .nullable()
  .refine(
    (doc) => doc === null || JSON.stringify(doc).length <= 50_000,
    "The description is too long.",
  );

export type TaskDescription = z.infer<typeof taskDescriptionSchema>;
