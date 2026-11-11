import { describe, expect, it } from "vitest";

import {
  byPosition,
  initialPositions,
  placeAfter,
  positionAtEnd,
  rebalance,
  type Positioned,
} from "@/lib/positions";

function list(...positions: string[]): Positioned[] {
  return positions.map((position, i) => ({ id: `t${String(i)}`, position }));
}

function order(items: Positioned[]): string[] {
  return [...items].sort(byPosition).map((item) => item.id);
}

describe("initialPositions", () => {
  it("creates increasing keys", () => {
    const keys = initialPositions(4);
    expect(keys).toHaveLength(4);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("positionAtEnd", () => {
  it("comes after every item, and works on an empty list", () => {
    const items = list(...initialPositions(3));
    const key = positionAtEnd(items);
    expect(items.every((item) => item.position < key)).toBe(true);
    expect(typeof positionAtEnd([])).toBe("string");
  });
});

describe("placeAfter", () => {
  const items = list(...initialPositions(3)); // t0, t1, t2

  function moved(afterId: string | null, movedId = "new") {
    const placement = placeAfter(items, movedId, afterId);
    if (placement.kind !== "key") throw new Error("expected a key");
    return order([
      ...items.filter((i) => i.id !== movedId),
      { id: movedId, position: placement.position },
    ]);
  }

  it("puts the item first", () => {
    expect(moved(null)).toEqual(["new", "t0", "t1", "t2"]);
  });

  it("puts the item between two others", () => {
    expect(moved("t0")).toEqual(["t0", "new", "t1", "t2"]);
  });

  it("puts the item last", () => {
    expect(moved("t2")).toEqual(["t0", "t1", "t2", "new"]);
  });

  it("moves an item already in the list", () => {
    expect(moved("t2", "t0")).toEqual(["t1", "t2", "t0"]);
  });

  it("puts the item last when its neighbour no longer exists", () => {
    expect(moved("gone")).toEqual(["t0", "t1", "t2", "new"]);
  });

  it("asks for a rebalance when neighbours share a key", () => {
    expect(placeAfter(list("a0", "a0"), "new", "t0")).toEqual({ kind: "rebalance" });
  });
});

describe("rebalance", () => {
  it("keeps the order and makes every key distinct", () => {
    const tied = [
      { id: "b", position: "a0" },
      { id: "a", position: "a0" },
      { id: "c", position: "a1" },
    ];
    const result = rebalance(tied);
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(new Set(result.map((item) => item.position)).size).toBe(3);
    expect(order(result)).toEqual(["a", "b", "c"]);
  });
});
