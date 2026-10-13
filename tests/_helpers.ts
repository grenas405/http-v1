import { type Context, createContext, nullPlatform, type Platform } from "../src/http/mod.ts";

export function ctxFor(request: Request, platform: Partial<Platform> = {}): Context {
  return createContext(request, nullPlatform(platform), { now: () => 0, id: () => "req-1" });
}

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEquals"}: expected ${e}, got ${a}`);
}

export function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assertThrows(fn: () => unknown, msg = "expected throw"): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(msg);
}
