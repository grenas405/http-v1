# Changes

## Unreleased

- `wrangler.jsonc` now runs `deno task bundle` as its build command (watching `src/` in dev), so
  `wrangler dev` and `wrangler deploy` work without a separate bundle step. `deno task dev`/`deploy`
  call wrangler directly.

## 0.1.0 — 2026-10-12

Initial release.

### Core (`src/http`)

- Runtime-agnostic `Handler`/`Middleware`/`Context`/`Platform` types on Fetch standards.
- Pure data-driven router with params, rest segments, 405 + `Allow`, HEAD→GET fallback.
- `compose()` for middleware; middleware for security headers, request ids, access logging, error
  boundary, request limits and default `Cache-Control`.
- Response helpers including RFC 9457 `problem()` and an open-redirect-safe `redirect()`.
- Streaming, size-bounded body readers returning `Result` values.
- Zod (`jsr:@zod/zod`) validation helpers: `parseBody`, `parseQuery`, `parseParams`.
- `h` HTML template tag with automatic escaping and `safeUrl()`.
- Structured logger over an injected sink.

### Cloudflare Workers adapter

- `toWorker()` maps `env`, `ExecutionContext` and an assets binding to `Platform`.
- Built with `deno bundle`; deployed with wrangler using `run_worker_first`.

### Portfolio

- Server-rendered homepage for Pedro M. Dominguez with a pointer-reactive variable-weight name, a
  live trace of a real request to `/api/status`, selected work, about, and a contact form validated
  server-side (works without JavaScript).
- JSON API: `/api/status`, `/api/profile`, `/api/projects`, `/api/projects/:slug`,
  `POST /api/contact`.
