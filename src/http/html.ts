/**
 * Context-aware-enough HTML templating: every interpolation is escaped unless it is an
 * `Html` value produced by this module (OWASP XSS Prevention, rule #1).
 *
 * ```ts
 * const page = render(h`<p>${userInput}</p>`);
 * ```
 *
 * @module
 */

const HTML_BRAND: unique symbol = Symbol("Html");

/** A fragment of trusted markup. Only `h` and `unsafeRaw` create one. */
export interface Html {
  readonly [HTML_BRAND]: true;
  readonly value: string;
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

/** Escape text for use in element content or a quoted attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (c) => ESCAPES[c]!);
}

function isHtml(value: unknown): value is Html {
  return typeof value === "object" && value !== null && HTML_BRAND in value;
}

/** Interpolation values `h` accepts. Arrays are joined; null/undefined/false render nothing. */
export type HtmlValue = Html | string | number | boolean | null | undefined | readonly HtmlValue[];

function toMarkup(value: HtmlValue): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(toMarkup).join("");
  if (isHtml(value)) return value.value;
  return escapeHtml(String(value));
}

function brand(value: string): Html {
  return { [HTML_BRAND]: true, value };
}

/** Tagged template that escapes every interpolation. */
export function h(strings: TemplateStringsArray, ...values: readonly HtmlValue[]): Html {
  let out = strings[0]!;
  for (let i = 0; i < values.length; i++) out += toMarkup(values[i]!) + strings[i + 1]!;
  return brand(out);
}

/** Mark a string as trusted markup. Never pass user input. */
export function unsafeRaw(markup: string): Html {
  return brand(markup);
}

/** Serialize an `Html` fragment to a string. */
export function render(fragment: Html): string {
  return fragment.value;
}

/** Allow only `https:`, `mailto:` and same-origin paths in `href`/`src` attributes. */
export function safeUrl(url: string): string {
  if (/^(https:|mailto:)/i.test(url) || (url.startsWith("/") && !url.startsWith("//"))) return url;
  return "#";
}
