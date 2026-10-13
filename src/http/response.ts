/**
 * Pure response constructors. Each returns a fresh `Response`; none touch globals.
 *
 * @module
 */

import { STATUS_TEXT, type StatusCode } from "./status.ts";

const JSON_TYPE = "application/json; charset=utf-8";
const PROBLEM_TYPE = "application/problem+json; charset=utf-8";

/** Merge `defaults` under `init.headers` without mutating either. */
function withHeaders(init: ResponseInit | undefined, defaults: HeadersInit): ResponseInit {
  const headers = new Headers(defaults);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return { ...init, headers };
}

/** `application/json` response. */
export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), withHeaders(init, { "content-type": JSON_TYPE }));
}

/** `text/plain` response. */
export function text(body: string, init?: ResponseInit): Response {
  return new Response(body, withHeaders(init, { "content-type": "text/plain; charset=utf-8" }));
}

/** `text/html` response. Callers are responsible for escaping interpolated values. */
export function html(body: string, init?: ResponseInit): Response {
  return new Response(body, withHeaders(init, { "content-type": "text/html; charset=utf-8" }));
}

/** Empty-bodied response, e.g. 204 or 304. */
export function empty(status: StatusCode, init?: ResponseInit): Response {
  return new Response(null, { ...init, status });
}

/**
 * Redirect to a same-origin path. Absolute URLs are rejected to prevent open redirects
 * (OWASP: Unvalidated Redirects and Forwards).
 */
export function redirect(
  location: string,
  status: 301 | 302 | 303 | 307 | 308 = 302,
): Response {
  if (!location.startsWith("/") || location.startsWith("//") || location.startsWith("/\\")) {
    throw new TypeError("redirect() only accepts same-origin paths");
  }
  return new Response(null, { status, headers: { location } });
}

/** RFC 9457 problem details body. */
export interface Problem {
  readonly type?: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly [extension: string]: unknown;
}

/**
 * RFC 9457 `application/problem+json` response. `detail` must be safe to show a client;
 * never pass exception messages or stack traces here.
 */
export function problem(
  status: StatusCode,
  fields: Omit<Problem, "status" | "title"> & { readonly title?: string } = {},
  init?: ResponseInit,
): Response {
  const body: Problem = { type: "about:blank", title: STATUS_TEXT[status], ...fields, status };
  return new Response(
    JSON.stringify(body),
    withHeaders({ ...init, status }, { "content-type": PROBLEM_TYPE }),
  );
}

/** Copy a response so its headers are mutable (fetched responses are often immutable). */
export function cloneMutable(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

/** Return a copy of `response` with `headers` set (overwriting existing keys). */
export function setHeaders(response: Response, headers: HeadersInit): Response {
  const copy = cloneMutable(response);
  new Headers(headers).forEach((value, key) => copy.headers.set(key, value));
  return copy;
}
