import { escapeHtml, h, render, safeUrl, unsafeRaw } from "../src/http/mod.ts";
import { assertEquals } from "./_helpers.ts";

Deno.test("h escapes interpolations but trusts nested fragments", () => {
  const evil = `"><img src=x onerror=alert(1)>`;
  assertEquals(
    render(h`<a title="${evil}">${h`<b>${"&"}</b>`}${unsafeRaw("<i></i>")}</a>`),
    `<a title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"><b>&amp;</b><i></i></a>`,
  );
  assertEquals(render(h`${[1, null, false, "x"]}`), "1x");
  assertEquals(escapeHtml("`'"), "&#96;&#39;");
});

Deno.test("safeUrl blocks script and protocol-relative URLs", () => {
  assertEquals(safeUrl("javascript:alert(1)"), "#");
  assertEquals(safeUrl("//evil.test"), "#");
  assertEquals(safeUrl("data:text/html,x"), "#");
  assertEquals(safeUrl("https://ok.test"), "https://ok.test");
  assertEquals(safeUrl("/path"), "/path");
});
