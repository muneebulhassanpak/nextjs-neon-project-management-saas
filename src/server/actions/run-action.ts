import "server-only";
import { APIError } from "better-auth/api";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { type ActionResult, toErrorBody } from "@/server/errors";
import { getRequestId } from "@/server/request-id";

/**
 * Runs a Server Action body and turns any failure into an `ActionResult`, so forms show a
 * message instead of crashing. Redirects and other Next.js control flow pass through.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    const requestId = await getRequestId();

    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: "Please check the highlighted fields.",
          requestId,
          fieldErrors: z.flattenError(error).fieldErrors,
        },
      };
    }
    // Errors from Better Auth (e.g. "slug already taken") are safe to show as they are.
    if (error instanceof APIError) {
      return {
        ok: false,
        error: {
          code: (error.body?.code ?? "auth_error").toLowerCase(),
          message: error.message,
          requestId,
        },
      };
    }
    return { ok: false, error: toErrorBody(error, requestId).body };
  }
}
