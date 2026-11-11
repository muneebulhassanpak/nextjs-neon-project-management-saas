import { describe, expect, it } from "vitest";

import { textField } from "@/lib/form-data";
import { formatDate, formatRelativeDays, formatRelativeTime } from "@/lib/format";

describe("formatDate", () => {
  it("formats in UTC", () => {
    expect(formatDate(new Date("2026-11-11T23:30:00Z"))).toBe("Nov 11, 2026");
  });
});

describe("formatRelativeDays", () => {
  const now = new Date("2026-11-11T12:00:00Z");

  it.each([
    [new Date("2026-11-18T12:00:00Z"), "in 7 days"],
    [new Date("2026-11-12T12:00:00Z"), "tomorrow"],
    [new Date("2026-11-11T12:00:00Z"), "today"],
  ])("%s → %s", (date, label) => {
    expect(formatRelativeDays(date, now)).toBe(label);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it.each([
    [ago(20_000), "just now"],
    [ago(5 * 60_000), "5m ago"],
    [ago(3 * 3_600_000), "3h ago"],
    [ago(30 * 3_600_000), "yesterday"],
    [ago(4 * 86_400_000), "4d ago"],
    [new Date("2026-11-01T12:00:00Z"), "Nov 1"],
  ])("%s → %s", (date, label) => {
    expect(formatRelativeTime(date, now)).toBe(label);
  });
});

describe("textField", () => {
  it("reads text and treats files and missing fields as empty", () => {
    const form = new FormData();
    form.set("name", "Acme");
    form.set("logo", new Blob(["x"]));

    expect(textField(form, "name")).toBe("Acme");
    expect(textField(form, "logo")).toBe("");
    expect(textField(form, "missing")).toBe("");
  });
});
