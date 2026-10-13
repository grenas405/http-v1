# Develop & deploy

## Requirements

- **Deno 2.4 or newer.** `deno bundle` was reintroduced in 2.4. Check with `deno --version`.
- **Node.js**, for `npx wrangler`. Wrangler is fetched on demand; nothing is installed into the
  project.
- **A Cloudflare account**, only for deploying.

## Everyday commands

| Command            | What happens                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `deno task dev`    | `wrangler dev`: runs the build, starts workerd on http://localhost:8787, rebuilds when `src/` changes |
| `deno task deploy` | `wrangler deploy`: runs the build, uploads `dist/worker.js` and `public/`                             |
| `deno task ci`     | Format check, lint, type check and tests. Run before deploying: the build itself does not type-check  |
| `deno task bundle` | The build on its own, if you want to inspect `dist/worker.js`                                         |

### First deploy

```sh
npx wrangler@4 login     # opens a browser to authorise wrangler with your account
deno task ci             # make sure types and tests pass
deno task deploy         # build and upload
```

Wrangler prints the `*.workers.dev` URL when it finishes. The Worker's name, `pedro-portfolio`,
comes from `wrangler.jsonc`.

## What `wrangler dev` and `wrangler deploy` do

Both commands start the same way:

1. Read `wrangler.jsonc`.
2. Run `build.command`, which is `deno task bundle`. This writes `dist/worker.js`.
   ([Build](build.md) explains this step.)
3. Take `main` (`dist/worker.js`) without bundling it again, because `no_bundle` is `true`.

Then:

- **`wrangler dev`** starts workerd locally with that file and serves `public/` through the `ASSETS`
  binding. It watches `build.watch_dir` (`src/`) and re-runs the build when a file changes. Local
  state lives in `.wrangler/`, which is git-ignored.
- **`wrangler deploy`** uploads the script and any changed files in `public/`, then makes the new
  version live.

## `wrangler.jsonc`, field by field

```jsonc
{
  "name": "pedro-portfolio",
  "main": "dist/worker.js",
  "no_bundle": true,
  "build": { "command": "deno task bundle", "watch_dir": "src" },
  "compatibility_date": "2025-09-01",
  "assets": { "directory": "./public", "binding": "ASSETS", "run_worker_first": true },
  "observability": { "enabled": true }
}
```

| Field                     | Purpose                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `name`                    | The Worker's name in your account and in its `workers.dev` URL.                                           |
| `main`                    | The script workerd runs. It is the build output, not a TypeScript file.                                   |
| `no_bundle`               | Upload `main` as-is. Wrangler's own bundler can't resolve `jsr:` imports.                                 |
| `build.command`           | Runs before dev and deploy, so `dist/worker.js` is never stale.                                           |
| `build.watch_dir`         | In dev, a change under `src/` triggers a rebuild.                                                         |
| `compatibility_date`      | Pins workerd's behaviour to that date's semantics, so runtime updates can't change how this code behaves. |
| `assets.directory`        | Uploaded as Workers Static Assets.                                                                        |
| `assets.binding`          | Exposes the asset store as `env.ASSETS`. Must match `assetsBinding` in `src/worker.ts`.                   |
| `assets.run_worker_first` | Every request runs the Worker first, so static files get the security headers too.                        |
| `observability.enabled`   | Sends the Worker's JSON logs to Workers Logs in the dashboard.                                            |

## Troubleshooting

**`Could not find version of '@zod/zod' … newer than the specified minimum dependency date`**

Deno refuses packages published less than 24 hours ago by default, as a guard against compromised
releases. Keep the constraint in `deno.json` on a version that is at least a day old, or wait.

**`wrangler dev` serves old code**

Check the terminal for a `[custom build]` error. When the build fails, no new `dist/worker.js` is
written, so whatever was there before is what workerd runs.

**A deploy succeeded but the Worker throws at runtime**

Run `deno task check`. The build strips types without checking them, so type errors don't stop a
deploy.

**Static files return 404**

They must be in `public/`, and the binding name in `wrangler.jsonc` must match `assetsBinding` in
`src/worker.ts`. If the binding is missing, `platform.assets` is undefined and `serveAssets` answers
404 rather than crashing.

**`ReferenceError: Deno is not defined`**

Something under `src/` called a `Deno.*` API. Those exist only in Deno, which builds and tests the
project; workerd runs it. Use Web-standard APIs instead.
