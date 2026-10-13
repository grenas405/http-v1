/**
 * Default `Cache-Control` for responses that don't set one. Use `no-store` on APIs so
 * proxies never cache personal or dynamic data.
 *
 * @module
 */

import { setHeaders } from "../response.ts";
import type { Middleware } from "../types.ts";

export function withDefaultCacheControl(value: string): Middleware {
  return (next) => async (request, context) => {
    const response = await next(request, context);
    return response.headers.has("cache-control")
      ? response
      : setHeaders(response, { "cache-control": value });
  };
}
