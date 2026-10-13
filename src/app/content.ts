/**
 * Portfolio content. This file is the single place to edit what the site says.
 * Entries marked `TODO` are placeholders to replace with real details.
 *
 * @module
 */

import type { Profile, Project } from "./schemas.ts";

export const PROFILE: Profile = {
  name: "Pedro M. Dominguez",
  role: "Software engineer",
  location: "TODO: City, Country",
  summary:
    "I build web software from the protocol up: small composable pieces, explicit data flow, and defaults that are safe before anyone asks.",
  about: [
    "Most of my work sits where requests meet code — routing, validation, the response a browser actually receives. I like making that layer boring in the best sense: predictable, observable, and hard to misuse.",
    "I favour plain functions over frameworks, standards over vendor APIs, and one tool doing one thing well. This site is served by the runtime-agnostic HTTP toolkit it describes.",
  ],
  principles: [
    {
      title: "Explicit over implicit",
      body: "Dependencies are passed in. Nothing reaches for a global it wasn't given.",
    },
    {
      title: "Secure by default",
      body: "Strict headers, bounded input, and validation at every boundary — before features.",
    },
    {
      title: "Portable",
      body: "Built on Fetch-standard Request and Response, so the code outlives any one host.",
    },
  ],
  links: [
    { label: "GitHub", href: "https://github.com/grenas405" },
    { label: "Email", href: "mailto:pedro.dfedro@gmail.com" },
  ],
};

export const PROJECTS: readonly Project[] = [
  {
    slug: "http-v1",
    name: "http-v1",
    year: 2026,
    summary:
      "A runtime-agnostic HTTP toolkit in TypeScript: pure router, composable middleware, Zod validation at the edge, and a Cloudflare Workers adapter.",
    stack: ["TypeScript", "Deno", "Cloudflare Workers", "Zod"],
    href: "https://github.com/grenas405/http-v1",
  },
  {
    slug: "todo-project-two",
    name: "TODO: Second project",
    year: 2025,
    summary: "TODO: One sentence on what it does and who it is for.",
    stack: ["TODO"],
    href: undefined,
  },
  {
    slug: "todo-project-three",
    name: "TODO: Third project",
    year: 2024,
    summary: "TODO: One sentence on what it does and who it is for.",
    stack: ["TODO"],
    href: undefined,
  },
];
