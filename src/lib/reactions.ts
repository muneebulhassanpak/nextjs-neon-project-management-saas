/** The reactions people can leave on a comment, in the order they're offered. */
export const REACTIONS = ["👍", "❤️", "🎉", "👀", "✅", "😄"] as const;

export type Reaction = (typeof REACTIONS)[number];

export const REACTION_LABELS: Record<Reaction, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "🎉": "Party",
  "👀": "Eyes",
  "✅": "Done",
  "😄": "Smile",
};

/** One emoji on one comment: who left it, and whether the current user did. */
export interface ReactionSummary {
  emoji: Reaction;
  count: number;
  mine: boolean;
  /** Names of the people who reacted, oldest first. */
  people: string[];
}

/** The reactions after the current user (`name`) toggles `emoji`, in the offered order. */
export function toggleReactionIn(
  reactions: ReactionSummary[],
  emoji: Reaction,
  name: string,
): ReactionSummary[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  let next: ReactionSummary[];
  if (existing?.mine) {
    const count = existing.count - 1;
    const people = [...existing.people];
    people.splice(people.lastIndexOf(name), 1);
    next =
      count === 0
        ? reactions.filter((r) => r !== existing)
        : reactions.map((r) => (r === existing ? { ...r, count, mine: false, people } : r));
  } else if (existing) {
    next = reactions.map((r) =>
      r === existing ? { ...r, count: r.count + 1, mine: true, people: [...r.people, name] } : r,
    );
  } else {
    next = [...reactions, { emoji, count: 1, mine: true, people: [name] }];
  }
  return next.sort((a, b) => REACTIONS.indexOf(a.emoji) - REACTIONS.indexOf(b.emoji));
}
