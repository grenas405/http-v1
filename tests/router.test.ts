import { compilePattern, createRouter, get, json, post, text } from "../src/http/mod.ts";
import { assert, assertEquals, assertThrows, ctxFor } from "./_helpers.ts";

Deno.test("compilePattern matches literals, params, and rest", () => {
  assertEquals(compilePattern("/a/b")("/a/b"), {});
  assertEquals(compilePattern("/a/b")("/a/c"), null);
  assertEquals(compilePattern("/u/:id")("/u/42"), { id: "42" });
  assertEquals(compilePattern("/u/:id")("/u/42/x"), null);
  assertEquals(compilePattern("/u/:id")("/u/"), null);
  assertEquals(compilePattern("/f/*")("/f/a/b.css"), { "*": "a/b.css" });
  assertEquals(compilePattern("/*")("/"), { "*": "" });
});

Deno.test("compilePattern decodes params and rejects malformed encoding", () => {
  assertEquals(compilePattern("/u/:id")("/u/a%20b"), { id: "a b" });
  assertEquals(compilePattern("/u/:id")("/u/%E0%A4%A"), null);
});

Deno.test("compilePattern rejects bad patterns", () => {
  assertThrows(() => compilePattern("nope"));
  assertThrows(() => compilePattern("/*/x"));
  assertThrows(() => compilePattern("/:1bad"));
});

Deno.test("router dispatches, 405s with Allow, and falls back", async () => {
  const app = createRouter([
    get("/hi/:name", (_r, c) => json({ hi: c.params.name })),
    post("/hi/:name", () => text("posted")),
  ]);
  const call = (method: string, path: string) => {
    const req = new Request(`https://x.test${path}`, { method });
    return app(req, ctxFor(req));
  };

  assertEquals(await (await call("GET", "/hi/pedro")).json(), { hi: "pedro" });
  assertEquals(await (await call("POST", "/hi/pedro")).text(), "posted");

  const del = await call("DELETE", "/hi/pedro");
  assertEquals(del.status, 405);
  assertEquals(del.headers.get("allow"), "GET, HEAD, POST");

  assertEquals((await call("GET", "/missing")).status, 404);
});

Deno.test("HEAD falls back to GET without a body", async () => {
  const app = createRouter([get("/", () => text("body"))]);
  const req = new Request("https://x.test/", { method: "HEAD" });
  const res = await app(req, ctxFor(req));
  assertEquals(res.status, 200);
  assert(res.body === null, "HEAD must not carry a body");
  assertEquals(res.headers.get("content-type"), "text/plain; charset=utf-8");
});
