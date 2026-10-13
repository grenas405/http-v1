# Documentation

How this project's TypeScript ends up answering requests on Cloudflare.

The short version: **Cloudflare never sees TypeScript.** `deno bundle` compiles `src/` into one
plain JavaScript file, `dist/worker.js`, on your machine. Wrangler uploads that file unchanged, and
workerd (Cloudflare's runtime, locally or at the edge) runs it like any other JavaScript module.

```
src/**/*.ts ──deno bundle──▶ dist/worker.js ──wrangler──▶ workerd
 TypeScript                   JavaScript                   runs JavaScript
```

| Document                      | Read it to learn                                                     |
| ----------------------------- | -------------------------------------------------------------------- |
| [Build](build.md)             | How TypeScript becomes `dist/worker.js`, and why Deno does the build |
| [Runtime](runtime.md)         | What workerd does with that file, step by step for one request       |
| [Develop & deploy](deploy.md) | Commands, what each `wrangler.jsonc` field does, and troubleshooting |
| [Adapters](adapters.md)       | Which code is Cloudflare-specific, and how to target another runtime |
