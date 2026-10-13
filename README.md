# http-v1

A runtime-agnostic HTTP toolkit in TypeScript, in the spirit of `jsr:@std/http`, plus the portfolio
site for **Pedro M. Dominguez** that it serves. The first adapter targets **Cloudflare Workers**.

## Documentation

How the TypeScript gets built and run on Cloudflare is covered in [`docs/`](docs/README.md):
[build](docs/build.md), [runtime](docs/runtime.md), [develop & deploy](docs/deploy.md) and
[adapters](docs/adapters.md).

## Design rules

- **Fetch standards only in the core.** `src/http` uses `Request`, `Response`, `URL`, streams and
  Web Crypto — nothing runtime-specific. Runtimes plug in via adapters.
- **Explicit over implicit.** Everything is a function. Dependencies (logger sink, contact sink,
  clock, content) are passed in at one composition root (`src/app/app.ts`). No globals, no
  singletons, no registration side effects.
- **No god classes.** One shape does all the work:
  `type Handler = (request, context) => Response | Promise<Response>` and
  `type Middleware = (next: Handler) => Handler`.
- **Unix philosophy.** Small modules that do one thing and compose: router, body readers,
  validation, each middleware, the HTML template tag.
- **Expected failures are values.** Body parsing and validation return `Result<T, E>` instead of
  throwing; errors become RFC 9457 `problem+json`.
- **OWASP by default** — see [Security](#security).

## Layout

```
src/
  http/                    runtime-agnostic core (published as ".")
    types.ts               Handler, Middleware, Context, Platform, Result
    router.ts              pure router: routes are data; 405 + Allow; HEAD→GET
    compose.ts             compose(middleware[], handler)
    context.ts             createContext(), nullPlatform()
    response.ts            json/text/html/empty/redirect/problem (RFC 9457)
    body.ts                streaming, size-bounded readBytes/readText/readJson/readForm
    validate.ts            Zod integration: parseBody/parseQuery/parseParams
    html.ts                h`` template tag that escapes every interpolation
    logger.ts              structured logger over an injected sink
    assets.ts              serveAssets via platform.assets
    middleware/            security_headers, request_id, access_log,
                           error_boundary, limits, cache_control
  adapters/cloudflare/     toWorker(build, { assetsBinding }) (published as "./cloudflare")
  app/                     the portfolio: content, Zod schemas, handlers, view
  worker.ts                Workers entry point
public/                    static assets served through the ASSETS binding
tests/                     deno test suites
```

## Usage

```ts
import { compose, createRouter, get, json, withSecurityHeaders } from "@pedro/http-v1";
import { toWorker } from "@pedro/http-v1/cloudflare";

const app = compose(
  [withSecurityHeaders()],
  createRouter([get("/hello/:name", (_req, ctx) => json({ hello: ctx.params.name }))]),
);

export default toWorker(() => app);
```

Validation with Zod (`jsr:@zod/zod`):

```ts
import { z } from "zod";
import { parseBody, post } from "@pedro/http-v1";

const Signup = z.strictObject({ email: z.email() });

post("/signup", async (req) => {
  const body = await parseBody(req, Signup, { limit: 4096 });
  if (!body.ok) return body.error; // 400 / 413 / 415 / 422 problem+json
  // body.value.data is typed and validated
});
```

Writing another adapter means building a `Platform` (`runtime`, `clientIp`, `waitUntil`, `assets`,
`env`) and calling `createContext(request, platform)` — see `src/adapters/cloudflare/mod.ts` (~90
lines).

## Development

Requires [Deno](https://deno.com) 2.4+ (for `deno bundle`) and Node for `npx wrangler`.

| Task               | What it does                                                 |
| ------------------ | ------------------------------------------------------------ |
| `deno task test`   | run the test suite                                           |
| `deno task ci`     | fmt check, lint, type check, tests                           |
| `deno task bundle` | bundle `src/worker.ts` (resolving `jsr:` imports) to `dist/` |
| `deno task dev`    | `wrangler dev` on http://localhost:8787 (rebuilds on change) |
| `deno task deploy` | `wrangler deploy` (needs `wrangler login` first)             |

`wrangler.jsonc` declares `deno task bundle` as its `build.command`, so plain `wrangler dev` /
`wrangler deploy` build first (dev re-runs it when `src/` changes). Wrangler uploads the Deno bundle
as-is (`no_bundle: true`), and `run_worker_first` routes every request — including static files —
through the Worker so security headers apply uniformly.

## Editing the portfolio

All copy lives in `src/app/content.ts` and is validated against the schemas in `src/app/schemas.ts`
by the test suite. Entries starting with `TODO` are placeholders. The homepage is server-rendered
from that file, so the site works without JavaScript; `public/app.js` adds the interactive hero, the
live request trace and in-place form errors.

The contact form currently logs receipt only (no message body or address, to keep personal data out
of logs). To deliver messages, replace `contactSink` in `src/worker.ts` with a real transport (e.g.
Cloudflare Email Workers or a Queue).

## Security

Mapped to OWASP guidance:

- **Secure headers:** strict CSP (`'self'` only, no inline script/style,
  `frame-ancestors
  'none'`), HSTS, `nosniff`, `X-Frame-Options`, COOP/CORP, Referrer- and
  Permissions-Policy; `Server`/`X-Powered-By` stripped.
- **Input validation:** every body, query string and route param goes through Zod; `strictObject`
  rejects unknown keys (mass assignment); control characters stripped.
- **Resource limits:** URL length cap, declared and _streamed_ body size limits, method allowlist
  (TRACE etc. → 501).
- **Output encoding:** the `h` template escapes all interpolations; `safeUrl` blocks
  `javascript:`/`data:`/protocol-relative links; client code builds DOM with `textContent` only.
- **Error handling:** an error boundary logs details server-side and returns a generic 500 with a
  request id; no stack traces reach clients.
- **Redirects:** `redirect()` only accepts same-origin paths.
- **Logging:** structured JSON with a server-generated request id; query strings and personal data
  are not logged.
- **Spam:** honeypot field; bots get the same 202 as people.
- **Supply chain:** one runtime dependency (Zod, from JSR); fonts self-hosted.
- **Not yet included:** rate limiting. On Workers, add the Rate Limiting binding or a WAF rule in
  front of `POST /api/contact` before relying on the form.
