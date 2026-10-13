/**
 * Bounded body readers. Every reader enforces a byte limit while streaming, so a
 * missing or lying `Content-Length` cannot exhaust memory (OWASP: resource consumption).
 *
 * @module
 */

import { err, ok, type Result } from "./types.ts";

/** Why a body could not be read. */
export type BodyError =
  | { readonly kind: "too-large"; readonly limit: number }
  | { readonly kind: "unsupported-media-type"; readonly expected: readonly string[] }
  | { readonly kind: "malformed"; readonly reason: string };

/** Lowercased media type without parameters, e.g. `"application/json"`. */
export function mediaType(request: Request): string {
  const header = request.headers.get("content-type") ?? "";
  return header.split(";", 1)[0]!.trim().toLowerCase();
}

/** Read the raw body as bytes, aborting once `limit` bytes are exceeded. */
export async function readBytes(
  request: Request,
  limit: number,
): Promise<Result<Uint8Array, BodyError>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return err({ kind: "too-large", limit });
  if (!request.body) return ok(new Uint8Array());

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return err({ kind: "too-large", limit });
    }
    chunks.push(value);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return ok(out);
}

/** Read the body as strict UTF-8 text. Invalid byte sequences are rejected, not replaced. */
export async function readText(
  request: Request,
  limit: number,
): Promise<Result<string, BodyError>> {
  const bytes = await readBytes(request, limit);
  if (!bytes.ok) return bytes;
  try {
    return ok(new TextDecoder("utf-8", { fatal: true }).decode(bytes.value));
  } catch {
    return err({ kind: "malformed", reason: "Body is not valid UTF-8" });
  }
}

const JSON_TYPES = ["application/json"] as const;
const FORM_TYPES = ["application/x-www-form-urlencoded"] as const;

/** Read and parse a JSON body. Requires `Content-Type: application/json`. */
export async function readJson(
  request: Request,
  limit: number,
): Promise<Result<unknown, BodyError>> {
  if (mediaType(request) !== "application/json") {
    return err({ kind: "unsupported-media-type", expected: JSON_TYPES });
  }
  const body = await readText(request, limit);
  if (!body.ok) return body;
  try {
    return ok(JSON.parse(body.value));
  } catch {
    return err({ kind: "malformed", reason: "Body is not valid JSON" });
  }
}

/**
 * Read a URL-encoded form into a plain object. Repeated keys keep the last value.
 * The result has a null prototype so keys like `__proto__` are inert.
 */
export async function readForm(
  request: Request,
  limit: number,
): Promise<Result<Record<string, string>, BodyError>> {
  if (mediaType(request) !== "application/x-www-form-urlencoded") {
    return err({ kind: "unsupported-media-type", expected: FORM_TYPES });
  }
  const body = await readText(request, limit);
  if (!body.ok) return body;
  const out: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(body.value)) out[key] = value;
  return ok(out);
}
