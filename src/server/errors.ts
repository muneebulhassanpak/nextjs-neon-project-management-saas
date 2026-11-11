import "server-only";

import { logger } from "@/server/logger";
import { getRequestId } from "@/server/request-id";

/**
 * One error format for every error response:
 *   { "error": { "code": "not_found", "message": "...", "requestId": "...", "details": ... } }
 */
export interface ErrorBody {
  code: string;
  message: string;
  requestId?: string | undefined;
  details?: unknown;
}

/** Base class for errors raised on purpose by the application. */
export class AppError extends Error {
  readonly status: number = 400;
  readonly code: string = "bad_request";

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  override readonly status = 422;
  override readonly code = "validation_error";
}

export class UnauthorizedError extends AppError {
  override readonly status = 401;
  override readonly code = "unauthorized";
}

export class ForbiddenError extends AppError {
  override readonly status = 403;
  override readonly code = "forbidden";
}

export class NotFoundError extends AppError {
  override readonly status = 404;
  override readonly code = "not_found";
}

export class ConflictError extends AppError {
  override readonly status = 409;
  override readonly code = "conflict";
}

export class PlanLimitError extends AppError {
  override readonly status = 402;
  override readonly code = "plan_limit";
}

/** Turns any thrown value into the standard error body. Unexpected errors never leak details. */
export function toErrorBody(
  error: unknown,
  requestId?: string,
): { status: number; body: ErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.message, requestId, details: error.details },
    };
  }
  logger.error({ err: error, requestId }, "unhandled error");
  return {
    status: 500,
    body: { code: "internal_error", message: "Something went wrong.", requestId },
  };
}

/** Route Handler wrapper: `export const GET = withErrorHandling(async (req) => ...)`. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const { status, body } = toErrorBody(error, await getRequestId());
      return Response.json({ error: body }, { status });
    }
  };
}

/** What every Server Action returns, so forms can show errors without try/catch. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorBody & { fieldErrors?: Record<string, string[]> } };
