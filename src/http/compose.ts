/**
 * Middleware composition.
 *
 * @module
 */

import type { Handler, Middleware } from "./types.ts";

/**
 * Wrap `handler` in `middleware`, outermost first:
 * `compose([a, b], h)` behaves like `a(b(h))`.
 */
export function compose(middleware: readonly Middleware[], handler: Handler): Handler {
  return middleware.reduceRight<Handler>((next, mw) => mw(next), handler);
}
