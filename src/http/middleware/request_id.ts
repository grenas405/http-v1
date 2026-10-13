/**
 * Echo the server-generated request id in `X-Request-Id`. The id is never taken from
 * the client, so it can't be used to forge or collide log entries.
 *
 * @module
 */

import { setHeaders } from "../response.ts";
import type { Middleware } from "../types.ts";

export const withRequestId: Middleware = (next) => async (request, context) =>
  setHeaders(await next(request, context), { "x-request-id": context.requestId });
