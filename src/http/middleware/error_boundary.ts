/**
 * Catch anything thrown below, log it with the request id, and return a generic 500.
 * Error details never reach the client (OWASP: Improper Error Handling).
 *
 * @module
 */

import type { Logger } from "../logger.ts";
import { problem } from "../response.ts";
import type { Middleware } from "../types.ts";

export function withErrorBoundary(logger: Logger): Middleware {
  return (next) => async (request, context) => {
    try {
      return await next(request, context);
    } catch (error) {
      logger.log("error", "unhandled", {
        requestId: context.requestId,
        method: request.method,
        path: context.url.pathname,
        error: error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
      });
      return problem(500, {
        detail: "Something failed on our side. Quote the request id if you report this.",
        requestId: context.requestId,
      });
    }
  };
}
