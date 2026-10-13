/**
 * Core types shared by every module. Nothing here depends on a runtime:
 * only the WHATWG Fetch primitives (`Request`, `Response`, `URL`).
 *
 * @module
 */

/** Fetches a static asset. Adapters supply this from whatever the runtime offers. */
export type AssetFetcher = (request: Request) => Promise<Response>;

/** Capabilities the host runtime exposes to handlers. Supplied by an adapter. */
export interface Platform {
  /** Name of the runtime, e.g. `"cloudflare"`. Informational only. */
  readonly runtime: string;
  /** Best-effort client address as reported by the runtime (never by a client header). */
  readonly clientIp: string | undefined;
  /** Keep the runtime alive until `promise` settles, without delaying the response. */
  readonly waitUntil: (promise: Promise<unknown>) => void;
  /** Static asset source, when the runtime has one. */
  readonly assets: AssetFetcher | undefined;
  /** Raw runtime environment (bindings, variables). Prefer typed accessors in app code. */
  readonly env: Readonly<Record<string, unknown>>;
}

/** Per-request, immutable context. Derive a new one with spread syntax; never mutate. */
export interface Context {
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly requestId: string;
  readonly startedAt: number;
  readonly platform: Platform;
}

/** The one function shape every layer speaks. */
export type Handler = (request: Request, context: Context) => Response | Promise<Response>;

/** A middleware takes the next handler and returns a new handler. */
export type Middleware = (next: Handler) => Handler;

/** HTTP methods the router understands. */
export type Method = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/** Discriminated result used instead of throwing for expected failures. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Construct a success result. */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/** Construct a failure result. */
export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
