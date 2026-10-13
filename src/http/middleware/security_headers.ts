/**
 * Security response headers following the OWASP Secure Headers Project.
 *
 * @module
 */

import { setHeaders } from "../response.ts";
import type { Middleware } from "../types.ts";

/** Content-Security-Policy directives, as a plain map. */
export type CspDirectives = Readonly<Record<string, readonly string[]>>;

/** A strict default CSP: same-origin everything, no inline script, no framing. */
export const STRICT_CSP: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": [],
};

/** Serialize CSP directives into a header value. */
export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export interface SecurityHeadersOptions {
  readonly csp?: CspDirectives;
  /** HSTS max-age in seconds; `0` omits the header. Default: two years. */
  readonly hstsMaxAge?: number;
}

/** Compute the header set. Pure; exported for inspection and tests. */
export function securityHeaders(
  { csp = STRICT_CSP, hstsMaxAge = 63_072_000 }: SecurityHeadersOptions = {},
): Headers {
  const headers = new Headers({
    "content-security-policy": serializeCsp(csp),
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  if (hstsMaxAge > 0) {
    headers.set("strict-transport-security", `max-age=${hstsMaxAge}; includeSubDomains`);
  }
  return headers;
}

/** Headers that leak implementation details and are removed from every response. */
const LEAKY = ["server", "x-powered-by", "x-aspnet-version"] as const;

/** Apply security headers to every response. */
export function withSecurityHeaders(options?: SecurityHeadersOptions): Middleware {
  const headers = securityHeaders(options);
  return (next) => async (request, context) => {
    const response = setHeaders(await next(request, context), headers);
    for (const name of LEAKY) response.headers.delete(name);
    return response;
  };
}
