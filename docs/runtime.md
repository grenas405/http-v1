# Runtime: how a request runs on Cloudflare

This picks up after [the build](build.md): `dist/worker.js` exists and has been handed to workerd,
either locally by `wrangler dev` or on Cloudflare's edge after `wrangler deploy`. The same file and
the same code paths run in both places.

## 1. workerd loads the module

workerd imports `dist/worker.js` as an ES module inside a V8 isolate. Importing runs the module's
top-level code once per isolate, which in this project does one thing: call
`toWorker(build, { assetsBinding: "ASSETS" })` and export the object it returns.

```ts
// src/worker.ts (compiled into dist/worker.js)
export default toWorker(() => createApp({ … }), { assetsBinding: "ASSETS" });
```

No routes are compiled and no handler is built yet. `build` is only stored.

An isolate is reused for many requests until Cloudflare evicts it, so anything created at module
level lives across requests. This project keeps no mutable state there apart from the handler cache
described below.

## 2. workerd calls `fetch(request, env, ctx)`

For every HTTP request, workerd calls the default export's `fetch` method with three arguments:

| Argument  | What it is                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------- |
| `request` | A standard Fetch `Request`.                                                                    |
| `env`     | The bindings declared in `wrangler.jsonc`. Here, `env.ASSETS` is the static-assets fetcher.    |
| `ctx`     | The execution context. `ctx.waitUntil(promise)` keeps work running after the response is sent. |

## 3. The adapter translates Cloudflare into a `Platform`

`toWorker` in `src/adapters/cloudflare/mod.ts` is the only place that knows about these Cloudflare
shapes. For each request it:

1. **Builds a `Platform`** with `toPlatform(request, env, ctx, options)`:
   - `runtime: "cloudflare"`
   - `clientIp` from the `cf-connecting-ip` header, which Cloudflare's edge sets itself
   - `waitUntil` forwarding to `ctx.waitUntil`
   - `assets` wrapping `env.ASSETS.fetch`, if the binding exists
   - `env` as-is, for app code that needs other bindings later
2. **Gets the app handler**, calling `build(env)` the first time it sees a given `env` object and
   caching the result in a `WeakMap` keyed by that object. When workerd passes the same `env` object
   to later requests, routes are compiled once per isolate. When it passes a new one, the handler is
   simply rebuilt; the result is identical either way, because `build` is a pure function of `env`.
3. **Creates the per-request `Context`** with `createContext(request, platform)`: the parsed `URL`,
   an empty `params` object, a fresh `requestId` from `crypto.randomUUID()`, and the start time. The
   context is frozen; later layers derive new ones instead of mutating it.
4. **Calls the handler** with `(request, context)` and returns its `Response` to workerd.

From here on, nothing is Cloudflare-specific.

## 4. The request passes through the middleware

`createApp` in `src/app/app.ts` wraps the router in five middleware, outermost first:

```
request ─▶ errorBoundary ─▶ accessLog ─▶ requestId ─▶ securityHeaders ─▶ limits ─▶ router
response ◀──────────────────────────────────────────────────────────────────────────┘
```

| Middleware        | On the way in                                                                     | On the way out                                        |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `errorBoundary`   | —                                                                                 | Turns any thrown error into a generic 500 and logs it |
| `accessLog`       | —                                                                                 | Logs method, path, status and duration as JSON        |
| `requestId`       | —                                                                                 | Adds `x-request-id`                                   |
| `securityHeaders` | —                                                                                 | Adds CSP, HSTS, `nosniff` and the rest                |
| `limits`          | Rejects other methods (501), long URLs (414), and oversized declared bodies (413) | —                                                     |

Because `limits` sits inside `securityHeaders`, even rejected requests get the security headers and
a request id.

## 5. The router picks a handler

The top-level router tries routes in order:

| Route             | Handled by                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `GET/POST /api/*` | The API router, which adds `cache-control: no-store` to responses |
| `GET /`           | The homepage, rendered on the server from `src/app/content.ts`    |
| `GET /*`          | `serveAssets`, which asks the `ASSETS` binding for the file       |

`HEAD` requests fall back to the matching `GET` route with the body removed. A path that exists
under a different method gets a 405 with an `Allow` header.

## 6. Work after the response

`POST /api/contact` validates the message with Zod, then hands delivery to `platform.waitUntil(...)`
and responds immediately with 202 (or a 303 redirect for the no-JS form). On Cloudflare that is
`ctx.waitUntil`, so the isolate keeps running until delivery finishes even though the visitor
already has their response.

## Static files

Files in `public/` are not part of `dist/worker.js`. Wrangler uploads them separately as Workers
Static Assets, and the Worker reaches them through the `ASSETS` binding.

`"run_worker_first": true` in `wrangler.jsonc` controls who answers first:

- **Without it**, Cloudflare would serve any request that matches a file straight from the asset
  store. The Worker would never run for `styles.css` or `app.js`, so those responses would lack the
  security headers.
- **With it**, every request runs the Worker. `serveAssets` calls `env.ASSETS.fetch` and the
  response passes back through the middleware, picking up the same headers as everything else.

`serveAssets` forwards only the request headers the asset store needs (`accept`, `accept-encoding`,
`if-none-match`, `if-modified-since`, `range`). Cookies and authorization headers never reach it.

## Locally vs. deployed

`wrangler dev` runs the same workerd binary locally, so behaviour matches production closely. The
differences that matter here:

- `cf-connecting-ip` may be missing locally, so `platform.clientIp` can be `undefined`.
- Over `http://localhost`, browsers ignore the `strict-transport-security` header.
- Logs appear in your terminal instead of Workers Logs (`observability.enabled` turns those on for
  the deployed Worker).
