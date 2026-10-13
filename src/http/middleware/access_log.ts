/**
 * Access logging. Logs the path but not the query string, which often carries
 * tokens or personal data (OWASP Logging Cheat Sheet).
 *
 * @module
 */

import type { Logger } from "../logger.ts";
import type { Middleware } from "../types.ts";

export function withAccessLog(logger: Logger, now: () => number = Date.now): Middleware {
  return (next) => async (request, context) => {
    const response = await next(request, context);
    logger.log("info", "request", {
      requestId: context.requestId,
      method: request.method,
      path: context.url.pathname,
      status: response.status,
      durationMs: now() - context.startedAt,
    });
    return response;
  };
}
