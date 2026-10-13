# Adapters

The HTTP module in `src/http/` runs anywhere that provides the standard Fetch API (`Request`,
`Response`, `URL`, `ReadableStream`, `crypto.randomUUID`). An adapter connects it to one specific
runtime. Cloudflare Workers is the first one.

## What is and isn't Cloudflare-specific

| Path                             | Knows about Cloudflare? | Role                                                            |
| -------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `src/http/`                      | No                      | Router, middleware, validation, responses                       |
| `src/app/`                       | No                      | The portfolio: content, schemas, handlers, homepage             |
| `src/adapters/cloudflare/mod.ts` | Yes                     | Turns `(request, env, ctx)` into `(request, context)`           |
| `src/worker.ts`                  | Yes                     | Entry point: picks the adapter and wires the app's dependencies |
| `wrangler.jsonc`                 | Yes                     | Build, bindings and deploy settings                             |

The adapter defines the Cloudflare types it uses (`ExecutionContext`, `FetcherBinding`) itself, as
small structural interfaces, so the project has no dependency on `@cloudflare/workers-types`.

## The contract

An adapter does three things for each request:

1. Build a `Platform` describing what the runtime offers:

   ```ts
   interface Platform {
     runtime: string; // e.g. "cloudflare"
     clientIp: string | undefined; // from the runtime, never a client header
     waitUntil: (promise: Promise<unknown>) => void; // finish work after responding
     assets: AssetFetcher | undefined; // static files, if the runtime has them
     env: Readonly<Record<string, unknown>>; // raw bindings / variables
   }
   ```

2. Call `createContext(request, platform)` to get the frozen per-request `Context`.
3. Call the app `Handler` with `(request, context)` and hand the `Response` back to the runtime.

## Sketch: a Deno adapter

Not part of the project yet. Shown to make the contract concrete.

```ts
import { createContext, type Handler, type Platform } from "../../http/mod.ts";
import { serveDir } from "jsr:@std/http/file-server";

export function serve(handler: Handler, { port = 8000, assetsDir = "public" } = {}) {
  return Deno.serve({ port }, (request, info) => {
    const platform: Platform = {
      runtime: "deno",
      clientIp: info.remoteAddr.hostname,
      waitUntil: (p) => void p.catch(() => {}), // Deno keeps running; nothing to extend
      assets: (req) => serveDir(req, { fsRoot: assetsDir }),
      env: Deno.env.toObject(),
    };
    return handler(request, createContext(request, platform));
  });
}
```

Its entry point would call `serve(createApp({ … }))` instead of `export default toWorker(...)`.
Nothing in `src/http/` or `src/app/` would change, and no bundling step is needed: Deno runs
TypeScript directly.
