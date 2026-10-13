// Progressive enhancement for the portfolio. The page works without this file.
// DOM is only ever built with textContent, never innerHTML.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Hero: letter weights follow the pointer ---------- */

const BASE_WEIGHT = 300;
const PEAK_WEIGHT = 800;

function initHero() {
  const name = document.querySelector(".hero-name");
  if (!name) return;
  const glyphs = [...name.querySelectorAll(".glyph")];
  const setWeight = (el, w) => {
    el.style.setProperty("--w", String(Math.round(w)));
    el.toggleAttribute("data-hot", w > 690);
  };

  if (reducedMotion) {
    for (const g of glyphs) setWeight(g, 560);
    return;
  }

  let centers = [];
  const measure = () => {
    centers = glyphs.map((g) => {
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  };

  // Influence radius scales with the type so it feels the same on any screen.
  const radius = () => parseFloat(getComputedStyle(name).fontSize) * 1.1;

  let frame = 0;
  let pointer = null;
  const paint = () => {
    frame = 0;
    const r = radius();
    glyphs.forEach((g, i) => {
      const c = centers[i];
      if (!pointer || !c) return setWeight(g, BASE_WEIGHT);
      const d = Math.hypot(pointer.x - c.x, pointer.y - c.y);
      const t = Math.max(0, 1 - d / r);
      setWeight(g, BASE_WEIGHT + (PEAK_WEIGHT - BASE_WEIGHT) * t * t * (3 - 2 * t));
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  // One orchestrated entrance: a single weight wave across the name, then rest.
  const wave = (start) => (now) => {
    const progress = (now - start) / 1400;
    glyphs.forEach((g, i) => {
      const phase = progress * (glyphs.length + 4) - i;
      const t = Math.max(0, 1 - Math.abs(phase - 2) / 2.5);
      setWeight(g, BASE_WEIGHT + (PEAK_WEIGHT - BASE_WEIGHT) * t);
    });
    if (progress < 1) requestAnimationFrame(wave(start));
    else {
      measure();
      addEventListener("pointermove", (e) => {
        pointer = { x: e.clientX, y: e.clientY };
        schedule();
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => {
        pointer = null;
        schedule();
      });
      addEventListener("resize", () => (measure(), schedule()), { passive: true });
      addEventListener("scroll", () => (measure(), schedule()), { passive: true });
    }
  };
  document.fonts.ready.then(() => requestAnimationFrame((now) => wave(now)(now)));
}

/* ---------- Live trace of a real request ---------- */

const SHOWN_HEADERS = [
  "content-type",
  "cache-control",
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "x-request-id",
];

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function span(cls, text) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

/** Build trace lines as arrays of [class, text] segments. Pure. */
function traceLines({ host, status, statusText, ms, headers, body }) {
  const ok = status >= 200 && status < 300;
  return [
    [["t-req", "GET /api/status HTTP/1.1"]],
    [["t-key", "host: "], ["t-val", host]],
    [["t-key", "accept: "], ["t-val", "application/json"]],
    [],
    [[ok ? "t-ok" : "t-bad", `${status} ${statusText || (ok ? "OK" : "Error")}`], [
      "t-time",
      `  ${ms} ms round trip`,
    ]],
    ...SHOWN_HEADERS.filter((h) => headers.has(h)).map((h) => [
      ["t-key", `${h}: `],
      ["t-val", truncate(headers.get(h), 64)],
    ]),
    [],
    [["t-val", truncate(body, 96)]],
  ];
}

async function runTrace(pre, button) {
  button.hidden = true;
  const code = document.createElement("code");
  pre.replaceChildren(code);

  let lines;
  try {
    const t0 = performance.now();
    const res = await fetch("/api/status", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const body = await res.text();
    lines = traceLines({
      host: location.host,
      status: res.status,
      statusText: res.statusText,
      ms: Math.round(performance.now() - t0),
      headers: res.headers,
      body,
    });
  } catch {
    lines = [[["t-req", "GET /api/status HTTP/1.1"]], [], [[
      "t-bad",
      "No response. The server is unreachable from this network.",
    ]]];
  }

  for (const segments of lines) {
    const line = document.createElement("span");
    for (const [cls, text] of segments) line.append(span(cls, text));
    line.append("\n");
    code.append(line);
    if (!reducedMotion) await sleep(segments.length ? 70 : 140);
  }
  code.append(span("t-cursor", ""));
  button.hidden = false;
}

function initTrace() {
  const pre = document.querySelector("[data-trace]");
  const button = document.querySelector("[data-trace-run]");
  if (!pre || !button) return;
  button.addEventListener("click", () => runTrace(pre, button));
  runTrace(pre, button);
}

/* ---------- Contact form: server is the single source of validation ---------- */

function initContact() {
  const form = document.querySelector("[data-contact]");
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  const button = form.querySelector("button[type=submit]");

  const say = (text, tone = "ok") => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const clearErrors = () => {
    for (const el of form.querySelectorAll("[data-error-for]")) el.textContent = "";
    for (const el of form.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
  };

  const showIssues = (issues) => {
    let first = null;
    for (const { path, message } of issues) {
      const field = form.elements.namedItem(path);
      const slot = form.querySelector(`[data-error-for="${CSS.escape(path)}"]`);
      if (!field || !slot) continue;
      slot.textContent = message;
      field.setAttribute("aria-invalid", "true");
      first ??= field;
    }
    first?.focus();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    say("");
    button.disabled = true;
    button.textContent = "Sending…";

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (res.status === 202) {
        form.reset();
        say("Message sent. I'll reply to the address you gave.");
      } else if (res.status === 422) {
        const problem = await res.json();
        showIssues(problem.issues ?? []);
        say("Fix the highlighted fields, then send again.", "error");
      } else {
        const id = res.headers.get("x-request-id");
        say(
          `The server refused the message (${res.status}). Try again later${
            id ? `, or quote ${id}` : ""
          }.`,
          "error",
        );
      }
    } catch {
      say("Couldn't reach the server. Check your connection and send again.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Send message";
    }
  });
}

initHero();
initTrace();
initContact();
