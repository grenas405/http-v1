import { z } from "zod";
import {
  compose,
  createLogger,
  type LogRecord,
  type Middleware,
  parseBody,
  problem,
  readBytes,
  redirect,
  securityHeaders,
  text,
  withErrorBoundary,
  withLimits,
  withSecurityHeaders,
} from "../src/http/mod.ts";
import { assert, assertEquals, assertThrows, ctxFor } from "./_helpers.ts";

Deno.test("compose applies middleware outermost-first", async () => {
  const tag = (t: string): Middleware => (next) => async (r, c) => {
    const res = await next(r, c);
    return text(`${t}(${await res.text()})`);
  };
  const h = compose([tag("a"), tag("b")], () => text("h"));
  const req = new Request("https://x.test/");
  assertEquals(await (await h(req, ctxFor(req))).text(), "a(b(h))");
});

Deno.test("redirect refuses off-site locations", () => {
  assertEquals(redirect("/ok", 303).headers.get("location"), "/ok");
  assertThrows(() => redirect("https://evil.test"));
  assertThrows(() => redirect("//evil.test"));
  assertThrows(() => redirect("/\\evil.test"));
});

Deno.test("problem() emits RFC 9457 JSON", async () => {
  const res = problem(404, { instance: "/x" });
  assertEquals(res.headers.get("content-type"), "application/problem+json; charset=utf-8");
  assertEquals(await res.json(), {
    type: "about:blank",
    title: "Not Found",
    instance: "/x",
    status: 404,
  });
});

Deno.test("security headers are set and leaky headers removed", async () => {
  const h = compose(
    [withSecurityHeaders()],
    () => text("x", { headers: { "x-powered-by": "me" } }),
  );
  const req = new Request("https://x.test/");
  const res = await h(req, ctxFor(req));
  assert(res.headers.get("content-security-policy")?.includes("script-src 'self'"));
  assertEquals(res.headers.get("x-content-type-options"), "nosniff");
  assertEquals(res.headers.get("x-frame-options"), "DENY");
  assertEquals(res.headers.get("x-powered-by"), null);
  assertEquals(securityHeaders({ hstsMaxAge: 0 }).has("strict-transport-security"), false);
});

Deno.test("error boundary hides details and logs them", async () => {
  const records: LogRecord[] = [];
  const logger = createLogger((r) => records.push(r));
  const h = compose([withErrorBoundary(logger)], () => {
    throw new Error("db password is hunter2");
  });
  const req = new Request("https://x.test/");
  const res = await h(req, ctxFor(req));
  assertEquals(res.status, 500);
  const body = await res.text();
  assert(!body.includes("hunter2"), "secret leaked to client");
  assert(body.includes("req-1"), "request id missing");
  assertEquals(records.length, 1);
});

Deno.test("limits reject unknown methods, long URLs, and big declared bodies", async () => {
  const h = compose(
    [withLimits({ maxUrlLength: 40, maxBodyBytes: 10, methods: ["GET", "POST"] })],
    () => text("ok"),
  );
  const run = (req: Request) => h(req, ctxFor(req));
  assertEquals((await run(new Request("https://x.test/", { method: "PUT" }))).status, 501);
  assertEquals((await run(new Request(`https://x.test/${"a".repeat(50)}`))).status, 414);
  assertEquals(
    (await run(
      new Request("https://x.test/", {
        method: "POST",
        body: "x".repeat(11),
        headers: { "content-length": "11" },
      }),
    )).status,
    413,
  );
  assertEquals((await run(new Request("https://x.test/"))).status, 200);
});

Deno.test("readBytes enforces the limit while streaming", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < 5; i++) c.enqueue(new Uint8Array(4));
      c.close();
    },
  });
  const req = new Request(
    "https://x.test/",
    { method: "POST", body: stream, duplex: "half" } as RequestInit,
  );
  const res = await readBytes(req, 10);
  assertEquals(res.ok, false);
});

Deno.test("parseBody validates JSON and form bodies, rejects others", async () => {
  const schema = z.strictObject({ n: z.coerce.number().int() });
  const mk = (type: string, body: string) =>
    new Request("https://x.test/", { method: "POST", headers: { "content-type": type }, body });

  const j = await parseBody(mk("application/json", '{"n":3}'), schema, { limit: 100 });
  assertEquals(j.ok && j.value, { data: { n: 3 }, format: "json" });

  const f = await parseBody(mk("application/x-www-form-urlencoded", "n=4"), schema, { limit: 100 });
  assertEquals(f.ok && f.value, { data: { n: 4 }, format: "form" });

  const bad = await parseBody(mk("application/json", '{"n":"x"}'), schema, { limit: 100 });
  assert(!bad.ok && bad.error.status === 422);

  const extra = await parseBody(mk("application/json", '{"n":1,"admin":true}'), schema, {
    limit: 100,
  });
  assert(!extra.ok && extra.error.status === 422, "unknown keys must be rejected");

  const broken = await parseBody(mk("application/json", "{"), schema, { limit: 100 });
  assert(!broken.ok && broken.error.status === 400);

  const xml = await parseBody(mk("application/xml", "<n/>"), schema, { limit: 100 });
  assert(!xml.ok && xml.error.status === 415);

  const big = await parseBody(mk("application/json", `{"n":${"1".repeat(200)}}`), schema, {
    limit: 100,
  });
  assert(!big.ok && big.error.status === 413);
});
