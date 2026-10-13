/**
 * Application composition root. All dependencies are wired here and nowhere else.
 *
 * @module
 */

import {
  compose,
  createLogger,
  createRouter,
  get,
  type Handler,
  html,
  type LogSink,
  notFound,
  post,
  render,
  serveAssets,
  withAccessLog,
  withDefaultCacheControl,
  withErrorBoundary,
  withLimits,
  withRequestId,
  withSecurityHeaders,
} from "../http/mod.ts";
import { PROFILE, PROJECTS } from "./content.ts";
import {
  type ContactSink,
  getProfile,
  getProject,
  getStatus,
  listProjects,
  submitContact,
} from "./handlers.ts";
import type { Profile, Project } from "./schemas.ts";
import { home } from "./views/home.ts";

export const VERSION = "0.1.0";

export interface AppDeps {
  readonly logSink: LogSink;
  readonly contactSink: ContactSink;
  readonly now?: () => number;
  readonly profile?: Profile;
  readonly projects?: readonly Project[];
}

/** Build the whole application as a single `Handler`. */
export function createApp(deps: AppDeps): Handler {
  const now = deps.now ?? Date.now;
  const logger = createLogger(deps.logSink, now);
  const profile = deps.profile ?? PROFILE;
  const projects = deps.projects ?? PROJECTS;

  const api = compose(
    [withDefaultCacheControl("no-store")],
    createRouter([
      get("/api/status", getStatus({ version: VERSION, now })),
      get("/api/profile", getProfile(profile)),
      get("/api/projects", listProjects(projects)),
      get("/api/projects/:slug", getProject(projects)),
      post("/api/contact", submitContact({ sink: deps.contactSink, logger, now })),
    ]),
  );

  const router = createRouter(
    [
      get("/api/*", api),
      post("/api/*", api),
      get(
        "/",
        (_req, ctx) =>
          html(
            render(home({ profile, projects, sent: ctx.url.searchParams.get("sent") === "1" })),
            {
              headers: { "cache-control": "no-cache" },
            },
          ),
      ),
      get("/*", serveAssets),
    ],
    notFound,
  );

  return compose(
    [
      withErrorBoundary(logger),
      withAccessLog(logger, now),
      withRequestId,
      withSecurityHeaders(),
      withLimits({ methods: ["GET", "HEAD", "POST"] }),
    ],
    router,
  );
}
