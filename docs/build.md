# Build: from TypeScript to JavaScript

workerd, the runtime behind Cloudflare Workers and `wrangler dev`, executes JavaScript only.
Everything in `src/` is TypeScript, so it has to be compiled before workerd can load it. That
happens in one step, on your machine:

```sh
deno task bundle
# = deno bundle --platform=browser --format=esm --minify --output=dist/worker.js src/worker.ts
```

You rarely run this yourself: `wrangler.jsonc` declares it as the build command, so `wrangler dev`
and `wrangler deploy` run it first (see [Develop & deploy](deploy.md)).

## What `deno bundle` does

`deno bundle` is esbuild driven by Deno's module resolver. Starting at `src/worker.ts`, it:

1. **Resolves every import.** Relative imports (`./app/app.ts`) are read from disk. The bare
   specifier `"zod"` is looked up in the `imports` map in `deno.json`, which points to
   `jsr:@zod/zod@^4.6.5`. `deno.lock` pins the exact version and its integrity hashes, so every
   build uses the same Zod code.
2. **Strips the types.** Type annotations, `interface` and `type` declarations, and `import type`
   statements are deleted. Nothing about the types is checked; see
   [Types are not checked at build time](#types-are-not-checked-at-build-time).
3. **Inlines everything into one file.** Your modules and Zod's become a single ES module with no
   `import` statements left, so the runtime never has to fetch or resolve anything.
4. **Minifies** the result and writes `dist/worker.js`.

The flags matter:

| Flag                 | Why                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--platform=browser` | Workers expose browser-style Web APIs (`fetch`, `Request`, `crypto`), not Node's. This keeps esbuild from assuming Node built-ins exist. |
| `--format=esm`       | Workers' module syntax requires an ES module whose default export is the handler object.                                                 |
| `--minify`           | Smaller upload and faster cold starts. Not required for correctness.                                                                     |
| `--output=…`         | The path `main` in `wrangler.jsonc` points at.                                                                                           |

## What comes out

`dist/worker.js` is plain, minified JavaScript. It ends with the module's only export:

```js
var sS=Jl(()=>{let e=Hr(mo);return zg({logSink:mo,contactSink:…})},{assetsBinding:"ASSETS"});
export{sS as default};
```

That is the minified form of `src/worker.ts`:

```ts
export default toWorker(() => createApp({ … }), { assetsBinding: "ASSETS" });
```

`toWorker()` returns an object with a `fetch(request, env, ctx)` method, which is exactly the shape
Cloudflare expects from a Worker's default export. [Runtime](runtime.md) picks up from there.

As of version 0.1.0 the bundle is about 470 KB minified and about 100 KB gzipped. Most of that is
Zod. Workers limit a script's compressed size, and this sits well under the limit on every plan.

`dist/` is listed in `.gitignore`: it is a build output, regenerated on every build, and never
committed.

## Why Deno builds it and not Wrangler

Wrangler can normally bundle TypeScript on its own (it also uses esbuild). It is wrangler that
compiles in that case, never workerd. But wrangler's bundler resolves imports the way Node does, and
it does not understand `jsr:` specifiers, so it cannot find Zod.

Deno resolves `jsr:` natively, so the project lets Deno bundle and tells wrangler to upload the
result as-is with `"no_bundle": true`. Each tool does one job:

| Tool     | Job                                                   |
| -------- | ----------------------------------------------------- |
| Deno     | Resolve, type-strip, bundle: TypeScript → one JS file |
| Wrangler | Run the build command, start workerd locally, upload  |
| workerd  | Execute the JavaScript                                |

## Types are not checked at build time

esbuild removes types without checking them. A type error in `src/` does **not** fail
`deno task bundle`, `wrangler dev` or `wrangler deploy`; the code is emitted and may fail at runtime
instead.

Type checking is a separate step:

```sh
deno task check   # deno check src tests
deno task ci      # fmt check + lint + type check + tests
```

Run `deno task ci` before deploying. If you want a type error to block every build, change the build
command in `wrangler.jsonc` to `deno task check && deno task bundle`. The cost is a few extra
seconds on each rebuild during `wrangler dev`.

## Things that are never in the bundle

- **`public/`.** Static files are uploaded separately as Workers Static Assets and reached through
  the `ASSETS` binding at runtime. See [Runtime](runtime.md#static-files).
- **`tests/`.** Only code reachable from `src/worker.ts` is bundled.
- **Deno APIs.** Nothing under `src/` calls `Deno.*`; it would not exist on workerd. The `deno.ns`
  entry in `compilerOptions.lib` is there for the tests, which do run on Deno.
