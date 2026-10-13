/**
 * Context construction. Adapters call `createContext` once per request.
 *
 * @module
 */

import type { Context, Platform } from "./types.ts";

/** Options for `createContext`; `now` and `id` are injectable for deterministic tests. */
export interface CreateContextOptions {
  readonly now?: () => number;
  readonly id?: () => string;
}

/** Build the immutable per-request context. */
export function createContext(
  request: Request,
  platform: Platform,
  { now = Date.now, id = () => crypto.randomUUID() }: CreateContextOptions = {},
): Context {
  return Object.freeze({
    url: new URL(request.url),
    params: Object.freeze({}),
    requestId: id(),
    startedAt: now(),
    platform,
  });
}

/** A platform with no capabilities. Useful for tests and as a base for adapters. */
export function nullPlatform(overrides: Partial<Platform> = {}): Platform {
  return Object.freeze({
    runtime: "unknown",
    clientIp: undefined,
    waitUntil: () => {},
    assets: undefined,
    env: Object.freeze({}),
    ...overrides,
  });
}
