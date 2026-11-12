import { TASK_PRIORITY_LABELS, type TaskPriority } from "./projects";

/**
 * What the activity log records. Each entry keeps a snapshot of the names it mentions (task
 * title, column names, people), so the history still reads correctly after something is renamed
 * or deleted.
 */
export type ActivityEvent =
  | { action: "task.created"; metadata: { title: string; column: string } }
  | { action: "task.moved"; metadata: { title: string; from: string; to: string } }
  | { action: "task.assigned"; metadata: { title: string; assignee: string | null } }
  | { action: "task.renamed"; metadata: { title: string; from: string } }
  | { action: "task.prioritized"; metadata: { title: string; priority: TaskPriority } }
  | { action: "task.scheduled"; metadata: { title: string; dueDate: string | null } }
  | { action: "task.described"; metadata: { title: string } }
  | { action: "task.labeled"; metadata: { title: string; labels: string[] } }
  | { action: "task.deleted"; metadata: { title: string } }
  | { action: "comment.added"; metadata: { title: string } }
  | { action: "project.created"; metadata: { name: string } }
  | { action: "project.updated"; metadata: { name: string } }
  | { action: "project.archived"; metadata: { name: string } }
  | { action: "project.restored"; metadata: { name: string } }
  | { action: "project.members"; metadata: { name: string; added: string[]; removed: string[] } }
  /** `role` is the label shown, e.g. "Member". */
  | { action: "member.joined"; metadata: { role: string } };

export type ActivityAction = ActivityEvent["action"];

/** The kinds of activity the Activity page filters by: the part of the action before the dot. */
export const ACTIVITY_KINDS = ["task", "comment", "project", "member"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  task: "Tasks",
  comment: "Comments",
  project: "Projects",
  member: "People",
};

export function isActivityKind(value: string): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value);
}

/** A piece of an activity sentence. `strong` parts are names (tasks, projects, columns). */
export interface ActivityPart {
  text: string;
  strong?: boolean;
}

const due = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function list(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/** The sentence after the actor's name, e.g. "moved *Fix login* from *To do* to *In progress*". */
export function describeActivity(event: ActivityEvent): ActivityPart[] {
  const t = (text: string): ActivityPart => ({ text });
  const s = (text: string): ActivityPart => ({ text, strong: true });

  switch (event.action) {
    case "task.created":
      return [t("created "), s(event.metadata.title), t(" in "), s(event.metadata.column)];
    case "task.moved":
      return [
        t("moved "),
        s(event.metadata.title),
        t(" from "),
        s(event.metadata.from),
        t(" to "),
        s(event.metadata.to),
      ];
    case "task.assigned":
      return event.metadata.assignee
        ? [t("assigned "), s(event.metadata.title), t(" to "), s(event.metadata.assignee)]
        : [t("unassigned "), s(event.metadata.title)];
    case "task.renamed":
      return [t("renamed "), s(event.metadata.from), t(" to "), s(event.metadata.title)];
    case "task.prioritized":
      return [
        t("set the priority of "),
        s(event.metadata.title),
        t(" to "),
        s(TASK_PRIORITY_LABELS[event.metadata.priority]),
      ];
    case "task.scheduled":
      return event.metadata.dueDate
        ? [
            t("set "),
            s(event.metadata.title),
            t(" due "),
            s(due.format(new Date(`${event.metadata.dueDate}T00:00:00Z`))),
          ]
        : [t("removed the due date of "), s(event.metadata.title)];
    case "task.described":
      return [t("updated the description of "), s(event.metadata.title)];
    case "task.labeled":
      return event.metadata.labels.length > 0
        ? [t("labeled "), s(event.metadata.title), t(" "), s(list(event.metadata.labels))]
        : [t("removed the labels from "), s(event.metadata.title)];
    case "task.deleted":
      return [t("deleted "), s(event.metadata.title)];
    case "comment.added":
      return [t("commented on "), s(event.metadata.title)];
    case "project.created":
      return [t("created the project "), s(event.metadata.name)];
    case "project.updated":
      return [t("updated the details of "), s(event.metadata.name)];
    case "project.archived":
      return [t("archived "), s(event.metadata.name)];
    case "project.restored":
      return [t("restored "), s(event.metadata.name)];
    case "project.members": {
      const { name, added, removed } = event.metadata;
      const parts: ActivityPart[] = [];
      if (added.length > 0) parts.push(t("added "), s(list(added)), t(" to "), s(name));
      if (added.length > 0 && removed.length > 0) parts.push(t(" and "));
      if (removed.length > 0) {
        parts.push(t("removed "), s(list(removed)), t(added.length > 0 ? "" : " from "));
        if (added.length === 0) parts.push(s(name));
      }
      return parts.length > 0 ? parts : [t("updated the members of "), s(name)];
    }
    case "member.joined":
      return [
        t(`joined the organization as ${article(event.metadata.role)} `),
        s(event.metadata.role),
      ];
  }
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
