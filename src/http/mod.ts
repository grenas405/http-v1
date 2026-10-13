/**
 * Runtime-agnostic HTTP toolkit built on WHATWG Fetch primitives.
 *
 * ```ts
 * import { compose, createRouter, get, json, withSecurityHeaders } from "@pedro/http-v1";
 *
 * const app = compose([withSecurityHeaders()], createRouter([
 *   get("/hello/:name", (_req, ctx) => json({ hello: ctx.params.name })),
 * ]));
 * ```
 *
 * Pair the resulting `Handler` with an adapter such as `@pedro/http-v1/cloudflare`.
 *
 * @module
 */

export * from "./types.ts";
export * from "./status.ts";
export * from "./response.ts";
export * from "./router.ts";
export * from "./compose.ts";
export * from "./context.ts";
export * from "./body.ts";
export * from "./validate.ts";
export * from "./logger.ts";
export * from "./assets.ts";
export * from "./html.ts";
export * from "./middleware/security_headers.ts";
export * from "./middleware/request_id.ts";
export * from "./middleware/access_log.ts";
export * from "./middleware/error_boundary.ts";
export * from "./middleware/limits.ts";
export * from "./middleware/cache_control.ts";
