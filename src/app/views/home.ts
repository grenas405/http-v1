/**
 * Homepage view: a pure function from content to markup. All interpolations are
 * escaped by `h`; URLs pass through `safeUrl`.
 *
 * @module
 */

import { h, type Html, safeUrl } from "../../http/html.ts";
import type { Profile, Project } from "../schemas.ts";

export interface HomeView {
  readonly profile: Profile;
  readonly projects: readonly Project[];
  /** True after a no-JS form submission redirected back with `?sent=1`. */
  readonly sent: boolean;
}

/** Split the name into per-letter spans the hero script animates; words stay unbroken. */
function glyphs(name: string): Html {
  const words = name.split(" ");
  return h`${
    words.map((word, wi) =>
      h`<span class="word">${[...word].map((ch) => h`<span class="glyph">${ch}</span>`)}</span>${
        wi < words.length - 1 ? " " : ""
      }`
    )
  }`;
}

function projectRow(p: Project): Html {
  return h`<li class="work-row">
      <span class="work-year">${p.year}</span>
      <div class="work-main">
        <h3 class="work-name">${
    p.href ? h`<a href="${safeUrl(p.href)}" rel="noopener noreferrer">${p.name}</a>` : p.name
  }</h3>
        <p class="work-summary">${p.summary}</p>
      </div>
      <ul class="work-stack" aria-label="Built with">${p.stack.map((s) => h`<li>${s}</li>`)}</ul>
    </li>`;
}

export function home({ profile, projects, sent }: HomeView): Html {
  const [first, ...rest] = profile.name.split(" ");
  const description = `${profile.name} — ${profile.role}. ${profile.summary}`;

  return h`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${profile.name}</title>
  <meta name="description" content="${description}">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0f2e2c">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/app.js"></script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="bar">
    <a class="bar-mark" href="/" aria-label="${profile.name}, home">PMD</a>
    <nav aria-label="Sections">
      <a href="#work">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="hero-name">
      <h1 id="hero-name" class="hero-name">
        <span class="visually-hidden">${profile.name}</span>
        <span class="hero-line" aria-hidden="true">${glyphs(first ?? "")}</span>
        <span class="hero-line" aria-hidden="true">${glyphs(rest.join(" "))}</span>
      </h1>

      <div class="hero-foot">
        <p class="hero-role">${profile.role}<span class="hero-place">${profile.location}</span></p>
        <p class="hero-summary">${profile.summary}</p>
        <ul class="hero-links">${
    profile.links.map((l) =>
      h`<li><a href="${safeUrl(l.href)}" rel="noopener noreferrer">${l.label}</a></li>`
    )
  }</ul>
      </div>

      <figure class="trace" aria-labelledby="trace-title">
        <figcaption id="trace-title" class="trace-title">
          This page asking its own server how it's doing
          <button type="button" class="trace-again" data-trace-run hidden>Ask again</button>
        </figcaption>
        <pre class="trace-body" data-trace aria-live="polite"><code>GET /api/status
Turn on JavaScript to watch the live exchange.</code></pre>
      </figure>
    </section>

    <section id="work" class="section work" aria-labelledby="work-title">
      <h2 id="work-title" class="section-title">Selected work</h2>
      <ol class="work-list" reversed>${projects.map(projectRow)}</ol>
    </section>

    <section id="about" class="section about" aria-labelledby="about-title">
      <h2 id="about-title" class="section-title">About</h2>
      <div class="about-prose">${profile.about.map((p) => h`<p>${p}</p>`)}</div>
      <dl class="principles">${
    profile.principles.map((p) => h`<div><dt>${p.title}</dt><dd>${p.body}</dd></div>`)
  }</dl>
    </section>

    <section id="contact" class="section contact" aria-labelledby="contact-title">
      <h2 id="contact-title" class="section-title">Get in touch</h2>
      <p class="contact-lede">Have a project, a role, or a question about this server? Send a note and I'll reply by email.</p>

      <form class="contact-form" action="/api/contact" method="post" novalidate data-contact>
        <div class="field">
          <label for="f-name">Name</label>
          <input id="f-name" name="name" autocomplete="name" required maxlength="100" aria-describedby="e-name">
          <p class="field-error" id="e-name" data-error-for="name"></p>
        </div>
        <div class="field">
          <label for="f-email">Email</label>
          <input id="f-email" name="email" type="email" autocomplete="email" required maxlength="254" aria-describedby="e-email">
          <p class="field-error" id="e-email" data-error-for="email"></p>
        </div>
        <div class="field field-wide">
          <label for="f-message">Message</label>
          <textarea id="f-message" name="message" rows="6" required minlength="10" maxlength="4000" aria-describedby="e-message"></textarea>
          <p class="field-error" id="e-message" data-error-for="message"></p>
        </div>
        <div class="honeypot" aria-hidden="true">
          <label for="f-website">Leave this empty</label>
          <input id="f-website" name="website" tabindex="-1" autocomplete="off">
        </div>
        <div class="form-foot">
          <button type="submit" class="send">Send message</button>
          <p class="form-status" role="status" data-form-status>${
    sent ? "Message sent. I'll reply to the address you gave." : ""
  }</p>
        </div>
      </form>
    </section>
  </main>

  <footer class="foot">
    <p>Served by <a href="https://github.com/grenas405/http-v1" rel="noopener noreferrer">http-v1</a>, a runtime-agnostic TypeScript HTTP toolkit, on Cloudflare Workers.</p>
  </footer>
</body>
</html>`;
}
