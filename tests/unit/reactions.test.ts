import { describe, expect, it } from "vitest";

import { toggleReactionIn, type ReactionSummary } from "@/lib/reactions";

const party: ReactionSummary = { emoji: "🎉", count: 1, mine: false, people: ["Grace"] };

describe("toggleReactionIn", () => {
  it("adds a new reaction in the offered order", () => {
    expect(toggleReactionIn([party], "👍", "Ada")).toEqual([
      { emoji: "👍", count: 1, mine: true, people: ["Ada"] },
      party,
    ]);
  });

  it("joins someone else's reaction", () => {
    expect(toggleReactionIn([party], "🎉", "Ada")).toEqual([
      { emoji: "🎉", count: 2, mine: true, people: ["Grace", "Ada"] },
    ]);
  });

  it("takes the user's reaction back, removing it when nobody's left", () => {
    const joined = toggleReactionIn([party], "🎉", "Ada");
    expect(toggleReactionIn(joined, "🎉", "Ada")).toEqual([
      { emoji: "🎉", count: 1, mine: false, people: ["Grace"] },
    ]);
    const alone = toggleReactionIn([], "👀", "Ada");
    expect(toggleReactionIn(alone, "👀", "Ada")).toEqual([]);
  });
});
