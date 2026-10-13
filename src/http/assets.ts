/**
 * Serve static assets through whatever `AssetFetcher` the platform provides.
 *
 * @module
 */

import { problem } from "./response.ts";
import type { Handler } from "./types.ts";

/**
 * Handler that delegates to `context.platform.assets`. Only GET and HEAD reach the
 * fetcher; a missing fetcher is a 404 rather than a crash.
 */
export const serveAssets: Handler = (request, context) => {
  const { assets } = context.platform;
  if (!assets) return problem(404, { instance: context.url.pathname });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return problem(405, {}, { headers: { allow: "GET, HEAD" } });
  }
  // Forward only what the asset layer needs: no cookies or auth headers.
  const forwarded = new Request(context.url, {
    method: request.method,
    headers: pick(request.headers, [
      "accept",
      "accept-encoding",
      "if-none-match",
      "if-modified-since",
      "range",
    ]),
  });
  return assets(forwarded);
};

function pick(headers: Headers, names: readonly string[]): Headers {
  const out = new Headers();
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null) out.set(name, value);
  }
  return out;
}
