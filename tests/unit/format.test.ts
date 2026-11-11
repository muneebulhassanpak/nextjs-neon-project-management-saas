import { describe, expect, it } from "vitest";

import { textField } from "@/lib/form-data";
import { formatDate, formatRelativeDays } from "@/lib/format";

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
