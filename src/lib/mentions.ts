import { z } from "zod";

/**
 * Comments store mentions as `<@userId>` tokens, so a mention still points at the right person
 * after they change their name. The UI shows the person's current name in place of the token.
 */

const MENTION = /<@([A-Za-z0-9_-]+)>/g;

export type CommentPart = { type: "text"; text: string } | { type: "mention"; userId: string };

export function mentionToken(userId: string): string {
  return `<@${userId}>`;
}

/** The ids mentioned in `body`, each once, in order of first mention. */
export function extractMentions(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(MENTION), (match) => match[1] ?? ""))].filter(
    Boolean,
  );
}

/** `body` split into plain text and mentions, for rendering. */
export function splitMentions(body: string): CommentPart[] {
  const parts: CommentPart[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION)) {
    if (match.index > last) parts.push({ type: "text", text: body.slice(last, match.index) });
    parts.push({ type: "mention", userId: match[1] ?? "" });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ type: "text", text: body.slice(last) });
  return parts;
}

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(5000, "Use at most 5,000 characters.");

export interface MentionTarget {
  id: string;
  name: string;
}

/**
 * Turns a stored body into what the comment box shows: tokens become `@Name`. Tokens for people
 * not in `people` become `@someone`, and are dropped from the result's `mentions`.
 */
export function toEditableText(
  body: string,
  people: readonly MentionTarget[],
): { text: string; mentions: MentionTarget[] } {
  const mentions = new Map<string, MentionTarget>();
  const text = splitMentions(body)
    .map((part) => {
      if (part.type === "text") return part.text;
      const person = people.find((p) => p.id === part.userId);
      if (!person) return "@someone";
      mentions.set(person.id, person);
      return `@${person.name}`;
    })
    .join("");
  return { text, mentions: [...mentions.values()] };
}

/**
 * The reverse of `toEditableText`: each `@Name` picked from the suggestions becomes a token.
 * Longer names go first, so "@Ada Lovelace" wins over "@Ada".
 */
export function toStoredBody(text: string, mentions: readonly MentionTarget[]): string {
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  let body = text;
  for (const person of byLength) body = replaceName(body, person);
  return body;
}

/** Replaces each `@Name` that isn't the start of a longer word. */
function replaceName(text: string, person: MentionTarget): string {
  const needle = `@${person.name}`;
  let result = "";
  let from = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    const next = text.charAt(at + needle.length);
    if (/[\p{L}\p{N}_]/u.test(next)) continue;
    result += text.slice(from, at) + mentionToken(person.id);
    from = at + needle.length;
  }
  return result + text.slice(from);
}

/** The `@query` being typed just before the caret, if any. */
export function mentionQueryAt(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, start: caret - query.length - 1 };
}
