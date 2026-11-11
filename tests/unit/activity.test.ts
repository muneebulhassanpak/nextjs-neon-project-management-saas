import { describe, expect, it } from "vitest";

import { describeActivity, type ActivityEvent } from "@/lib/activity";

const text = (event: ActivityEvent) =>
  describeActivity(event)
    .map((part) => (part.strong ? `*${part.text}*` : part.text))
    .join("");

describe("describeActivity", () => {
  it.each<[ActivityEvent, string]>([
    [
      { action: "task.created", metadata: { title: "A", column: "To do" } },
      "created *A* in *To do*",
    ],
    [
      { action: "task.moved", metadata: { title: "Fix login", from: "To do", to: "In progress" } },
      "moved *Fix login* from *To do* to *In progress*",
    ],
    [
      { action: "task.assigned", metadata: { title: "A", assignee: "Alex" } },
      "assigned *A* to *Alex*",
    ],
    [{ action: "task.assigned", metadata: { title: "A", assignee: null } }, "unassigned *A*"],
    [{ action: "task.renamed", metadata: { title: "B", from: "A" } }, "renamed *A* to *B*"],
    [
      { action: "task.prioritized", metadata: { title: "A", priority: "urgent" } },
      "set the priority of *A* to *Urgent*",
    ],
    [
      { action: "task.scheduled", metadata: { title: "A", dueDate: "2026-03-05" } },
      "set *A* due *Mar 5, 2026*",
    ],
    [
      { action: "task.scheduled", metadata: { title: "A", dueDate: null } },
      "removed the due date of *A*",
    ],
    [{ action: "task.described", metadata: { title: "A" } }, "updated the description of *A*"],
    [
      { action: "task.labeled", metadata: { title: "A", labels: ["Bug", "UI", "API"] } },
      "labeled *A* *Bug, UI and API*",
    ],
    [
      { action: "task.labeled", metadata: { title: "A", labels: [] } },
      "removed the labels from *A*",
    ],
    [{ action: "task.deleted", metadata: { title: "A" } }, "deleted *A*"],
    [{ action: "comment.added", metadata: { title: "A" } }, "commented on *A*"],
    [{ action: "project.created", metadata: { name: "Web" } }, "created the project *Web*"],
    [{ action: "project.updated", metadata: { name: "Web" } }, "updated the details of *Web*"],
    [{ action: "project.archived", metadata: { name: "Web" } }, "archived *Web*"],
    [{ action: "project.restored", metadata: { name: "Web" } }, "restored *Web*"],
    [
      { action: "project.members", metadata: { name: "Web", added: ["Ann", "Bo"], removed: [] } },
      "added *Ann and Bo* to *Web*",
    ],
    [
      { action: "project.members", metadata: { name: "Web", added: [], removed: ["Cy"] } },
      "removed *Cy* from *Web*",
    ],
    [
      { action: "project.members", metadata: { name: "Web", added: ["Ann"], removed: ["Cy"] } },
      "added *Ann* to *Web* and removed *Cy*",
    ],
    [
      { action: "project.members", metadata: { name: "Web", added: [], removed: [] } },
      "updated the members of *Web*",
    ],
    [
      { action: "member.joined", metadata: { role: "Admin" } },
      "joined the organization as an *Admin*",
    ],
    [
      { action: "member.joined", metadata: { role: "Member" } },
      "joined the organization as a *Member*",
    ],
  ])("%j", (event, expected) => {
    expect(text(event)).toBe(expected);
  });
});
