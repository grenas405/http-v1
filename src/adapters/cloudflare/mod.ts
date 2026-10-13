/**
 * Cloudflare Workers adapter. Turns a runtime-agnostic `Handler` into a Worker's
 * `ExportedHandler`. The only Cloudflare-specific code in the project lives here.
 *
 * ```ts
 * import { toWorker } from "@pedro/http-v1/cloudflare";
 * export default toWorker(() => handler, { assetsBinding: "ASSETS" });
 * ```
 *
 * @module
 */

import { createContext } from "../../http/context.ts";
import type { AssetFetcher, Handler, Platform } from "../../http/types.ts";

/** Structural subset of Cloudflare's `ExecutionContext`; avoids a types dependency. */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Structural subset of a Fetcher binding such as the static-assets binding. */
export interface FetcherBinding {
  fetch(input: Request): Promise<Response>;
}

/** Structural subset of Cloudflare's `ExportedHandler`. */
export interface WorkerHandler<Env> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export interface WorkerOptions {
  /** Name of the static-assets binding in `wrangler.jsonc`, if any. */
  readonly assetsBinding?: string;
}

function isFetcher(value: unknown): value is FetcherBinding {
  return typeof value === "object" && value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function";
}

/** Build the agnostic `Platform` from Cloudflare's request, env and execution context. */
export function toPlatform(
  request: Request,
  env: Readonly<Record<string, unknown>>,
  ctx: ExecutionContext,
  { assetsBinding }: WorkerOptions = {},
): Platform {
  const binding = assetsBinding ? env[assetsBinding] : undefined;
  const assets: AssetFetcher | undefined = isFetcher(binding)
    ? (req) => binding.fetch(req)
    : undefined;
  return Object.freeze({
    runtime: "cloudflare",
    // Set by Cloudflare's edge; clients cannot spoof it through the proxy.
    clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise),
    assets,
    env,
  });
}

/**
 * Adapt a handler factory to a Worker. `build` receives the env once per isolate-env
 * pair (memoized by identity), so configuration is explicit and routing tables compile once.
 */
export function toWorker<Env extends object>(
  build: (env: Env) => Handler,
  options: WorkerOptions = {},
): WorkerHandler<Env> {
  const cache = new WeakMap<Env, Handler>();
  const handlerFor = (env: Env): Handler => {
    let handler = cache.get(env);
    if (!handler) {
      handler = build(env);
      cache.set(env, handler);
    }
    return handler;
  };

  return {
    fetch(request, env, ctx) {
      const platform = toPlatform(
        request,
        env as Readonly<Record<string, unknown>>,
        ctx,
        options,
      );
      return Promise.resolve(handlerFor(env)(request, createContext(request, platform)));
    },
  };
}
