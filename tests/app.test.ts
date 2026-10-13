import { toWorker } from "../src/adapters/cloudflare/mod.ts";
import { createApp } from "../src/app/app.ts";
import { PROFILE, PROJECTS } from "../src/app/content.ts";
import type { ContactSink } from "../src/app/handlers.ts";
import { ProfileSchema, ProjectSchema } from "../src/app/schemas.ts";
import { nullSink } from "../src/http/mod.ts";
import { assert, assertEquals } from "./_helpers.ts";

type Sent = Parameters<ContactSink>[0];

function setup() {
  const sent: Sent[] = [];
  const pending: Promise<unknown>[] = [];
  const worker = toWorker(
    () => createApp({ logSink: nullSink, contactSink: (m) => (sent.push(m), Promise.resolve()) }),
    { assetsBinding: "ASSETS" },
  );
  const env = {
    ASSETS: {
      fetch: (r: Request) => Promise.resolve(new Response(`asset:${new URL(r.url).pathname}`)),
    },
  };
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException() {},
  };
  const call = (path: string, init?: RequestInit) =>
    worker.fetch(new Request(`https://pedro.test${path}`, init), env, ctx);
  return { call, sent, flush: () => Promise.all(pending) };
}

Deno.test("content satisfies its own schemas", () => {
  ProfileSchema.parse(PROFILE);
  for (const p of PROJECTS) ProjectSchema.parse(p);
});

Deno.test("API returns JSON with security headers and no-store", async () => {
  const { call } = setup();
  const res = await call("/api/projects");
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("cache-control"), "no-store");
  assert(res.headers.get("content-security-policy"));
  assert(res.headers.get("x-request-id"));
  assertEquals((await res.json()).length, PROJECTS.length);
});

Deno.test("project filtering and lookup validate input", async () => {
  const { call } = setup();
  assertEquals((await (await call("/api/projects?stack=zod")).json()).length, 1);
  assertEquals((await call("/api/projects?evil=1")).status, 422);
  assertEquals((await call("/api/projects/http-v1")).status, 200);
  assertEquals((await call("/api/projects/..%2Fetc")).status, 404);
  assertEquals((await call("/api/nope")).status, 404);
});

Deno.test("static assets go through the binding, wrapped in security headers", async () => {
  const { call } = setup();
  const res = await call("/styles.css", { headers: { cookie: "secret=1" } });
  assertEquals(await res.text(), "asset:/styles.css");
  assertEquals(res.headers.get("x-frame-options"), "DENY");
});

Deno.test("contact: JSON accepted, form redirects, honeypot swallowed, bad input 422", async () => {
  const { call, sent, flush } = setup();
  const good = { name: "Ada", email: "ada@example.com", message: "Hello there, Pedro!" };

  const json = await call("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(good),
  });
  assertEquals(json.status, 202);

  const form = await call("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(good).toString(),
  });
  assertEquals(form.status, 303);
  assertEquals(form.headers.get("location"), "/?sent=1#contact");

  const bot = await call("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...good, website: "spam.example" }),
  });
  assertEquals(bot.status, 202);

  const bad = await call("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...good, email: "nope" }),
  });
  assertEquals(bad.status, 422);
  const issues = (await bad.json()).issues as { path: string }[];
  assertEquals(issues.map((i) => i.path), ["email"]);

  await flush();
  assertEquals(sent.length, 2);
});

Deno.test("disallowed methods are refused globally", async () => {
  const { call } = setup();
  assertEquals((await call("/", { method: "DELETE" })).status, 501);
  assertEquals((await call("/api/contact", { method: "GET" })).status, 405);
});

Deno.test("homepage is server-rendered with escaped content", async () => {
  const worker = toWorker(() =>
    createApp({
      logSink: nullSink,
      contactSink: () => Promise.resolve(),
      profile: { ...PROFILE, summary: "<script>alert(1)</script>" },
    })
  );
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const res = await worker.fetch(new Request("https://pedro.test/?sent=1"), {}, ctx);
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await res.text();
  assert(!body.includes("<script>alert(1)"), "unescaped content");
  assert(body.includes("&lt;script&gt;alert(1)"));
  assert(body.includes("Message sent."));
});
