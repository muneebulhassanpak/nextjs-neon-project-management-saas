import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  pgErrorCode,
  PlanLimitError,
  toErrorBody,
  UnauthorizedError,
  ValidationError,
  withErrorHandling,
} from "@/server/errors";

const headers = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(headers) }));

describe("toErrorBody", () => {
  it.each([
    [new ValidationError("bad input"), 422, "validation_error"],
    [new UnauthorizedError("sign in"), 401, "unauthorized"],
    [new ForbiddenError("no access"), 403, "forbidden"],
    [new NotFoundError("missing"), 404, "not_found"],
    [new ConflictError("taken"), 409, "conflict"],
    [new PlanLimitError("upgrade"), 402, "plan_limit"],
    [new AppError("generic"), 400, "bad_request"],
  ])("maps %o to its status and code", (error, status, code) => {
    const result = toErrorBody(error, "req-1");

    expect(result.status).toBe(status);
    expect(result.body).toEqual({
      code,
      message: error.message,
      requestId: "req-1",
      details: undefined,
    });
  });

  it("keeps details from application errors", () => {
    const details = { field: "email" };

    expect(toErrorBody(new ValidationError("bad input", details)).body.details).toBe(details);
  });

  it("hides the message of unexpected errors", () => {
    const result = toErrorBody(new Error("connection string with secrets"), "req-2");

    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      code: "internal_error",
      message: "Something went wrong.",
      requestId: "req-2",
    });
  });

  it("names errors after their class", () => {
    expect(new NotFoundError("missing").name).toBe("NotFoundError");
  });
});

describe("withErrorHandling", () => {
  beforeEach(() => {
    headers.set("x-request-id", "req-42");
  });

  it("passes successful responses through", async () => {
    const handler = withErrorHandling(() => Promise.resolve(Response.json({ ok: true })));

    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("turns thrown errors into the standard error response", async () => {
    const handler = withErrorHandling(() => Promise.reject(new NotFoundError("Project not found")));

    const response = await handler();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Project not found", requestId: "req-42" },
    });
  });
});

describe("database errors", () => {
  /** How Drizzle surfaces a Postgres error: the driver error sits in `cause`. */
  function dbError(code: string) {
    return Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("pg"), { code }),
    });
  }

  it.each([
    ["42501", 403, "forbidden"],
    ["23505", 409, "conflict"],
    ["23503", 409, "conflict"],
  ])("maps SQLSTATE %s to %s", (sqlState, status, code) => {
    expect(toErrorBody(dbError(sqlState))).toMatchObject({ status, body: { code } });
  });

  it("treats other database errors as unexpected", () => {
    expect(toErrorBody(dbError("57014")).status).toBe(500);
  });

  it("reads the code from the error or its cause, ignoring non-SQLSTATE codes", () => {
    expect(pgErrorCode(Object.assign(new Error(), { code: "23505" }))).toBe("23505");
    expect(pgErrorCode(dbError("42501"))).toBe("42501");
    expect(pgErrorCode(Object.assign(new Error(), { code: "ECONNREFUSED" }))).toBeUndefined();
    expect(pgErrorCode("nope")).toBeUndefined();
  });
});
