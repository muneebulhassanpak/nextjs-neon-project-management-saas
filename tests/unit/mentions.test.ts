import { describe, expect, it } from "vitest";

import {
  commentBodySchema,
  extractMentions,
  mentionQueryAt,
  mentionToken,
  splitMentions,
  toEditableText,
  toStoredBody,
} from "@/lib/mentions";

describe("mentions", () => {
  const body = `Hey ${mentionToken("u1")}, can you and ${mentionToken("u_2")} check? ${mentionToken("u1")}`;

  it("extracts each mentioned id once, in order", () => {
    expect(extractMentions(body)).toEqual(["u1", "u_2"]);
    expect(extractMentions("no mentions, just an @email")).toEqual([]);
  });

  it("splits text and mentions for rendering", () => {
    expect(splitMentions(body)).toEqual([
      { type: "text", text: "Hey " },
      { type: "mention", userId: "u1" },
      { type: "text", text: ", can you and " },
      { type: "mention", userId: "u_2" },
      { type: "text", text: " check? " },
      { type: "mention", userId: "u1" },
    ]);
    expect(splitMentions("plain")).toEqual([{ type: "text", text: "plain" }]);
    expect(splitMentions("")).toEqual([]);
  });

  it("ignores malformed tokens", () => {
    expect(extractMentions("<@> <@bad id> <@ok>")).toEqual(["ok"]);
  });

  it("validates comment bodies", () => {
    expect(commentBodySchema.parse("  hi  ")).toBe("hi");
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("x".repeat(5001)).success).toBe(false);
  });

  describe("editing", () => {
    const ada = { id: "u1", name: "Ada" };
    const adaL = { id: "u2", name: "Ada Lovelace" };
    const odd = { id: "u3", name: "J. (Jo) Doe" };

    it("shows tokens as names and remembers who they point at", () => {
      expect(
        toEditableText(`Hi ${mentionToken("u2")} and ${mentionToken("gone")}`, [ada, adaL]),
      ).toEqual({
        text: "Hi @Ada Lovelace and @someone",
        mentions: [adaL],
      });
    });

    it("turns picked names back into tokens, longest name first", () => {
      expect(toStoredBody("@Ada Lovelace, ask @Ada.", [ada, adaL])).toBe(
        `${mentionToken("u2")}, ask ${mentionToken("u1")}.`,
      );
      expect(toStoredBody("@Adam is not @Ada", [ada])).toBe(`@Adam is not ${mentionToken("u1")}`);
      expect(toStoredBody("cc @J. (Jo) Doe", [odd])).toBe(`cc ${mentionToken("u3")}`);
    });

    it("round-trips", () => {
      const body = `${mentionToken("u1")} meet ${mentionToken("u3")}`;
      const { text, mentions } = toEditableText(body, [ada, odd]);
      expect(toStoredBody(text, mentions)).toBe(body);
    });

    it("finds the @query before the caret", () => {
      expect(mentionQueryAt("Hey @ad", 7)).toEqual({ query: "ad", start: 4 });
      expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
      expect(mentionQueryAt("Hey @ad more", 12)).toBeNull();
      expect(mentionQueryAt("mail@example", 12)).toBeNull();
      expect(mentionQueryAt("Hey @ad more", 7)).toEqual({ query: "ad", start: 4 });
    });
  });
});
