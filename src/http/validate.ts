/**
 * Validation at the trust boundary, backed by Zod. Handlers receive typed values or a
 * ready-made RFC 9457 response, never raw input.
 *
 * @module
 */

import type { z } from "zod";
import { type BodyError, mediaType, readForm, readJson } from "./body.ts";
import { problem } from "./response.ts";
import { err, ok, type Result } from "./types.ts";

/** One client-safe validation issue. */
export interface Issue {
  readonly path: string;
  readonly message: string;
}

/** Flatten Zod issues into a client-safe list (no received values are echoed back). */
export function toIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
}

/** Parse `input` with `schema`, returning a `Result` instead of throwing. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Result<z.output<S>, Issue[]> {
  const parsed = schema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(toIssues(parsed.error));
}

/** Map a body-reading failure to the right problem response. */
export function bodyErrorResponse(error: BodyError): Response {
  switch (error.kind) {
    case "too-large":
      return problem(413, { detail: `Request body exceeds ${error.limit} bytes.` });
    case "unsupported-media-type":
      return problem(
        415,
        { detail: `Expected ${error.expected.join(" or ")}.` },
        { headers: { "accept-post": error.expected.join(", ") } },
      );
    case "malformed":
      return problem(400, { detail: error.reason });
  }
}

/** 422 response listing validation issues. */
export function issuesResponse(issues: readonly Issue[]): Response {
  return problem(422, { detail: "The request did not pass validation.", issues });
}

/** Options for body parsing helpers. */
export interface ParseBodyOptions {
  /** Maximum body size in bytes. */
  readonly limit: number;
}

/** What a parsed body looked like on the wire; lets handlers tailor the response. */
export type BodyFormat = "json" | "form";

/**
 * Read a JSON or URL-encoded body and validate it with `schema`.
 * Returns the typed value plus the wire format, or a finished error `Response`.
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  { limit }: ParseBodyOptions,
): Promise<Result<{ data: z.output<S>; format: BodyFormat }, Response>> {
  const type = mediaType(request);
  const format: BodyFormat | null = type === "application/json"
    ? "json"
    : type === "application/x-www-form-urlencoded"
    ? "form"
    : null;
  if (!format) {
    return err(bodyErrorResponse({
      kind: "unsupported-media-type",
      expected: ["application/json", "application/x-www-form-urlencoded"],
    }));
  }

  const raw = format === "json" ? await readJson(request, limit) : await readForm(request, limit);
  if (!raw.ok) return err(bodyErrorResponse(raw.error));

  const valid = validate(schema, raw.value);
  return valid.ok ? ok({ data: valid.value, format }) : err(issuesResponse(valid.error));
}

/** Validate the URL query string against `schema`. Repeated keys keep the last value. */
export function parseQuery<S extends z.ZodType>(
  url: URL,
  schema: S,
): Result<z.output<S>, Response> {
  const input: Record<string, string> = Object.create(null);
  for (const [key, value] of url.searchParams) input[key] = value;
  const valid = validate(schema, input);
  return valid.ok ? ok(valid.value) : err(issuesResponse(valid.error));
}

/** Validate route params against `schema`. Failures are 404s: the resource doesn't exist. */
export function parseParams<S extends z.ZodType>(
  params: Readonly<Record<string, string>>,
  schema: S,
): Result<z.output<S>, Response> {
  const valid = validate(schema, params);
  return valid.ok ? ok(valid.value) : err(problem(404));
}
