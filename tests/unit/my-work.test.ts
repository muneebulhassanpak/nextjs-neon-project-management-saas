import { describe, expect, it } from "vitest";

import { groupMyWork, groupOf, type MyWorkTask } from "@/lib/my-work";

const TODAY = "2026-11-12";

function task(overrides: Partial<MyWorkTask>): MyWorkTask {
  return {
    id: overrides.title ?? "t",
    title: "Task",
    priority: "none",
    dueDate: null,
    projectId: "p",
    projectName: "Website",
    columnName: "To do",
    done: false,
    checklist: null,
    ...overrides,
  };
}

describe("groupOf", () => {
  it("puts tasks in the right bucket around today", () => {
    expect(groupOf(task({ dueDate: "2026-11-11" }), TODAY)).toBe("overdue");
    expect(groupOf(task({ dueDate: TODAY }), TODAY)).toBe("today");
    expect(groupOf(task({ dueDate: "2026-11-13" }), TODAY)).toBe("week");
    expect(groupOf(task({ dueDate: "2026-11-19" }), TODAY)).toBe("week");
    expect(groupOf(task({ dueDate: "2026-11-20" }), TODAY)).toBe("later");
    expect(groupOf(task({ dueDate: null }), TODAY)).toBe("none");
    expect(groupOf(task({ dueDate: "2026-01-01", done: true }), TODAY)).toBe("done");
  });

  it("counts the week across a month end", () => {
    expect(groupOf(task({ dueDate: "2026-12-05" }), "2026-11-28")).toBe("week");
  });
});

describe("groupMyWork", () => {
  it("orders groups, then tasks by date, priority and title, and drops empty groups", () => {
    const groups = groupMyWork(
      [
        task({ title: "Later", dueDate: "2027-01-01" }),
        task({ title: "B low", dueDate: TODAY, priority: "low" }),
        task({ title: "A urgent", dueDate: TODAY, priority: "urgent" }),
        task({ title: "Late", dueDate: "2026-11-01" }),
        task({ title: "Someday" }),
      ],
      TODAY,
    );

    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ["Overdue", ["Late"]],
      ["Today", ["A urgent", "B low"]],
      ["Later", ["Later"]],
      ["No due date", ["Someday"]],
    ]);
  });
});
