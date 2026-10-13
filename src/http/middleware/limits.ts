/**
 * Cheap request guards applied before any handler runs.
 *
 * @module
 */

import { problem } from "../response.ts";
import type { Method, Middleware } from "../types.ts";

export interface LimitsOptions {
  /** Reject URLs longer than this many characters. Default 2048. */
  readonly maxUrlLength?: number;
  /** Reject declared bodies larger than this. Readers enforce it again while streaming. */
  readonly maxBodyBytes?: number;
  /** Methods accepted at all. Anything else is 501. */
  readonly methods?: readonly Method[];
}

const DEFAULT_METHODS: readonly Method[] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

/** Reject oversized URLs, oversized declared bodies, and unknown methods (e.g. TRACE). */
export function withLimits(
  { maxUrlLength = 2048, maxBodyBytes = 1_048_576, methods = DEFAULT_METHODS }: LimitsOptions = {},
): Middleware {
  const allowed = new Set<string>(methods);
  return (next) => (request, context) => {
    if (!allowed.has(request.method)) return problem(501);
    if (request.url.length > maxUrlLength) return problem(414);
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBodyBytes) {
      return problem(413, { detail: `Request body exceeds ${maxBodyBytes} bytes.` });
    }
    return next(request, context);
  };
}
