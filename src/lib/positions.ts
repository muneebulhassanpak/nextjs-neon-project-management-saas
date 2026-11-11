import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * Ordering for board columns and tasks, with fractional indexes: each item stores a sortable
 * string key, and a move writes one new key between its new neighbours instead of renumbering
 * the whole list. Keys must be compared byte-wise (`collate "C"` in Postgres, `<` in JS).
 */

export interface Positioned {
  id: string;
  position: string;
}

/** Sorts by position, then id, so items with the same key (after a race) keep a stable order. */
export function byPosition<T extends Positioned>(a: T, b: T): number {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Keys for `count` items in order, e.g. the default columns of a new project. */
export function initialPositions(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}

/** A key after every item in `items`. */
export function positionAtEnd(items: readonly Positioned[]): string {
  const last = [...items].sort(byPosition).at(-1);
  return generateKeyBetween(last?.position ?? null, null);
}

export type Placement = { kind: "key"; position: string } | { kind: "rebalance" };

/**
 * Where to put `movedId` so it comes right after `afterId` (or first, when `afterId` is null)
 * among `items`. `items` may include the moved item; it's ignored. An unknown `afterId` (e.g.
 * deleted meanwhile) places the item last.
 *
 * Returns `rebalance` when the neighbours share a key (two people dropped into the same gap at
 * once), so there's no key between them; the caller then renumbers the list.
 */
export function placeAfter(
  items: readonly Positioned[],
  movedId: string,
  afterId: string | null,
): Placement {
  const others = items.filter((item) => item.id !== movedId).sort(byPosition);
  const index = afterId === null ? -1 : others.findIndex((item) => item.id === afterId);
  const lower = afterId !== null && index === -1 ? others.at(-1) : others[index];
  const upper = afterId !== null && index === -1 ? undefined : others[index + 1];

  const lowerKey = lower?.position ?? null;
  const upperKey = upper?.position ?? null;
  if (lowerKey !== null && upperKey !== null && lowerKey >= upperKey) return { kind: "rebalance" };
  return { kind: "key", position: generateKeyBetween(lowerKey, upperKey) };
}

/** Fresh, evenly spread keys for `items` in their current order. */
export function rebalance<T extends Positioned>(items: readonly T[]): (T & Positioned)[] {
  const sorted = [...items].sort(byPosition);
  const keys = generateNKeysBetween(null, null, sorted.length);
  return sorted.map((item, i) => ({ ...item, position: keys[i] ?? item.position }));
}
