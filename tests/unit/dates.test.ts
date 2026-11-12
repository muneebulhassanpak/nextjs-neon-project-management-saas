import { describe, expect, it } from "vitest";

import { avatarTone, AVATAR_TONE_COUNT } from "@/lib/avatar-tone";
import { addDays, todayIn } from "@/lib/dates";

describe("todayIn", () => {
  const lateEvening = new Date("2026-11-12T21:30:00Z");

  it("uses the viewer's calendar, not UTC", () => {
    expect(todayIn("UTC", lateEvening)).toBe("2026-11-12");
    expect(todayIn("Asia/Karachi", lateEvening)).toBe("2026-11-13");
    expect(todayIn("America/Los_Angeles", lateEvening)).toBe("2026-11-12");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(todayIn("Mars/Olympus", lateEvening)).toBe("2026-11-12");
  });
});

describe("addDays", () => {
  it("moves across months and years", () => {
    expect(addDays("2026-11-12", 6)).toBe("2026-11-18");
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("avatarTone", () => {
  it("gives the same person the same colour every time", () => {
    expect(avatarTone("user-1")).toBe(avatarTone("user-1"));
  });

  it("spreads people across the palette", () => {
    const tones = new Set(Array.from({ length: 40 }, (_, i) => avatarTone(`person-${i}`)));
    expect(tones.size).toBeGreaterThanOrEqual(AVATAR_TONE_COUNT - 2);
  });
});
