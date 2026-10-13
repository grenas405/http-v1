/**
 * A small, pure router. Routes are plain data; `createRouter` compiles them once into
 * a `Handler`. No registration methods, no hidden mutable table.
 *
 * Pattern syntax:
 * - `/static`      literal segment
 * - `/:name`       one segment, captured as `params.name`
 * - `/*`           the rest of the path (only as the last segment), captured as `params["*"]`
 *
 * @module
 */

import { problem } from "./response.ts";
import type { Context, Handler, Method } from "./types.ts";

/** A route is data: method, pattern, handler. */
export interface Route {
  readonly method: Method;
  readonly pattern: string;
  readonly handler: Handler;
}

/** Matches a pathname, returning captured params or `null`. */
export type PathMatcher = (pathname: string) => Readonly<Record<string, string>> | null;

type Segment =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "param"; readonly name: string }
  | { readonly kind: "rest" };

const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseSegment(raw: string, isLast: boolean, pattern: string): Segment {
  if (raw === "*") {
    if (!isLast) throw new SyntaxError(`"*" must be the last segment in "${pattern}"`);
    return { kind: "rest" };
  }
  if (raw.startsWith(":")) {
    const name = raw.slice(1);
    if (!PARAM_NAME.test(name)) throw new SyntaxError(`Invalid param "${raw}" in "${pattern}"`);
    return { kind: "param", name };
  }
  return { kind: "literal", value: raw };
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").slice(1);
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Compile a pattern into a matcher. Throws `SyntaxError` on malformed patterns. */
export function compilePattern(pattern: string): PathMatcher {
  if (!pattern.startsWith("/")) throw new SyntaxError(`Pattern must start with "/": "${pattern}"`);
  const raw = splitPath(pattern);
  const segments = raw.map((s, i) => parseSegment(s, i === raw.length - 1, pattern));
  const hasRest = segments.at(-1)?.kind === "rest";

  return (pathname) => {
    const parts = splitPath(pathname);
    const fixed = hasRest ? segments.length - 1 : segments.length;
    if (hasRest ? parts.length < fixed : parts.length !== fixed) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < fixed; i++) {
      const seg = segments[i]!;
      const part = parts[i]!;
      if (seg.kind === "literal") {
        if (seg.value !== part) return null;
      } else if (seg.kind === "param") {
        const decoded = safeDecode(part);
        if (decoded === null || decoded === "") return null;
        params[seg.name] = decoded;
      }
    }
    if (hasRest) {
      const rest = safeDecode(parts.slice(fixed).join("/"));
      if (rest === null) return null;
      params["*"] = rest;
    }
    return Object.freeze(params);
  };
}

/** Route constructor. */
export function route(method: Method, pattern: string, handler: Handler): Route {
  return { method, pattern, handler };
}

/** Shorthand constructors. */
export const get = (pattern: string, handler: Handler): Route => route("GET", pattern, handler);
export const post = (pattern: string, handler: Handler): Route => route("POST", pattern, handler);
export const put = (pattern: string, handler: Handler): Route => route("PUT", pattern, handler);
export const patch = (pattern: string, handler: Handler): Route => route("PATCH", pattern, handler);
export const del = (pattern: string, handler: Handler): Route => route("DELETE", pattern, handler);

/** Default fallback: RFC 9457 404. */
export const notFound: Handler = (_req, ctx) => problem(404, { instance: ctx.url.pathname });

interface Compiled {
  readonly method: Method;
  readonly match: PathMatcher;
  readonly handler: Handler;
}

function allowedMethods(compiled: readonly Compiled[], pathname: string): Method[] {
  const methods = new Set<Method>();
  for (const r of compiled) {
    if (r.match(pathname)) {
      methods.add(r.method);
      if (r.method === "GET") methods.add("HEAD");
    }
  }
  return [...methods];
}

/** Strip the body from a response while keeping status and headers (for HEAD). */
function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Compile routes into a single handler. First matching route wins (order is explicit).
 * - `HEAD` falls back to the matching `GET` route with the body stripped.
 * - A path that matches with the wrong method yields `405` with an `Allow` header.
 * - Anything else goes to `fallback`.
 */
export function createRouter(routes: readonly Route[], fallback: Handler = notFound): Handler {
  const compiled: readonly Compiled[] = routes.map((r) => ({
    method: r.method,
    match: compilePattern(r.pattern),
    handler: r.handler,
  }));

  const find = (method: string, pathname: string) => {
    for (const r of compiled) {
      if (r.method !== method) continue;
      const params = r.match(pathname);
      if (params) return { handler: r.handler, params };
    }
    return null;
  };

  return async (request: Request, context: Context): Promise<Response> => {
    const { pathname } = context.url;
    const exact = find(request.method, pathname);
    if (exact) return exact.handler(request, { ...context, params: exact.params });

    if (request.method === "HEAD") {
      const viaGet = find("GET", pathname);
      if (viaGet) {
        return withoutBody(await viaGet.handler(request, { ...context, params: viaGet.params }));
      }
    }

    const allow = allowedMethods(compiled, pathname);
    if (allow.length > 0) {
      return problem(405, { instance: pathname }, { headers: { allow: allow.join(", ") } });
    }
    return fallback(request, context);
  };
}
