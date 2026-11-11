import { APIError } from "better-auth/api";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { NotFoundError } from "@/server/errors";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-request-id": "req-7" })),
}));

describe("runAction", () => {
  it("wraps the result", async () => {
    expect(await runAction(() => Promise.resolve(42))).toEqual({ ok: true, data: 42 });
  });

  it("returns field errors for invalid input", async () => {
    const schema = z.object({ name: z.string().min(2, "Too short") });

    const result = await runAction(() => Promise.resolve(schema.parse({ name: "a" })));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation_error", fieldErrors: { name: ["Too short"] }, requestId: "req-7" },
    });
  });

  it("passes auth errors through with their message", async () => {
    const result = await runAction(() =>
      Promise.reject(new APIError("BAD_REQUEST", { message: "Slug is taken", code: "SLUG_TAKEN" })),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "slug_taken", message: "Slug is taken" },
    });
  });

  it("maps application errors to the standard body", async () => {
    const result = await runAction(() => Promise.reject(new NotFoundError("No such member")));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "No such member" },
    });
  });

  it("lets redirects through", async () => {
    await expect(runAction(() => Promise.resolve(redirect("/somewhere")))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });
});
