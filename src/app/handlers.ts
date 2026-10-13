/**
 * Route handlers. Each is a plain function of (request, context) plus explicitly
 * injected dependencies; none reads module-level mutable state.
 *
 * @module
 */

import {
  type Handler,
  json,
  type Logger,
  parseBody,
  parseParams,
  parseQuery,
  problem,
  redirect,
} from "../http/mod.ts";
import {
  ContactSchema,
  type Profile,
  type Project,
  ProjectParamsSchema,
  ProjectQuerySchema,
} from "./schemas.ts";

/** Contact bodies are short; anything bigger is not a message. */
export const CONTACT_LIMIT_BYTES = 16_384;

export function getProfile(profile: Profile): Handler {
  return () => json(profile);
}

/** Pure filter, exported for tests. */
export function filterProjects(projects: readonly Project[], stack: string | undefined): Project[] {
  if (!stack) return [...projects];
  const needle = stack.toLowerCase();
  return projects.filter((p) => p.stack.some((s) => s.toLowerCase() === needle));
}

export function listProjects(projects: readonly Project[]): Handler {
  return (_req, ctx) => {
    const query = parseQuery(ctx.url, ProjectQuerySchema);
    if (!query.ok) return query.error;
    return json(filterProjects(projects, query.value.stack));
  };
}

export function getProject(projects: readonly Project[]): Handler {
  return (_req, ctx) => {
    const params = parseParams(ctx.params, ProjectParamsSchema);
    if (!params.ok) return params.error;
    const project = projects.find((p) => p.slug === params.value.slug);
    return project ? json(project) : problem(404, { instance: ctx.url.pathname });
  };
}

/** Where accepted messages go. Swap for email, a queue, or storage via the adapter's env. */
export type ContactSink = (message: {
  readonly name: string;
  readonly email: string;
  readonly message: string;
  readonly receivedAt: string;
}) => Promise<void>;

/**
 * Accept a contact message as JSON (from the enhanced form) or URL-encoded (no-JS form).
 * Honeypot hits get the same success response so bots learn nothing.
 */
export function submitContact(deps: {
  readonly sink: ContactSink;
  readonly logger: Logger;
  readonly now: () => number;
}): Handler {
  return async (request, ctx) => {
    const parsed = await parseBody(request, ContactSchema, { limit: CONTACT_LIMIT_BYTES });
    if (!parsed.ok) return parsed.error;
    const { data, format } = parsed.value;

    if (data.website === "") {
      ctx.platform.waitUntil(
        deps.sink({
          name: data.name,
          email: data.email,
          message: data.message,
          receivedAt: new Date(deps.now()).toISOString(),
        }).catch((error: unknown) =>
          deps.logger.log("error", "contact sink failed", {
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          })
        ),
      );
    } else {
      deps.logger.log("warn", "contact honeypot", { requestId: ctx.requestId });
    }

    return format === "form"
      ? redirect("/?sent=1#contact", 303)
      : json({ status: "received" }, { status: 202 });
  };
}

/** Lightweight status endpoint; the homepage uses it to show a live request trace. */
export function getStatus(deps: { readonly version: string; readonly now: () => number }): Handler {
  return (_req, ctx) =>
    json({
      status: "ok",
      version: deps.version,
      runtime: ctx.platform.runtime,
      requestId: ctx.requestId,
      serverTimeMs: deps.now() - ctx.startedAt,
    });
}
