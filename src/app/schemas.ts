/**
 * Zod schemas: the contract for everything crossing the trust boundary.
 *
 * @module
 */

import { z } from "zod";

const httpsOrMailto = z.string().refine(
  (v) => v.startsWith("https://") || v.startsWith("mailto:"),
  "Links must be https: or mailto:",
);

export const ProjectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  year: z.number().int().min(1990).max(2100),
  summary: z.string().min(1).max(280),
  stack: z.array(z.string().min(1).max(40)).max(12),
  href: httpsOrMailto.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProfileSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  summary: z.string().min(1),
  about: z.array(z.string().min(1)),
  principles: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })),
  links: z.array(z.object({ label: z.string().min(1), href: httpsOrMailto })),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Route params for `/api/projects/:slug`. */
export const ProjectParamsSchema = z.object({ slug: ProjectSchema.shape.slug });

/** Optional filters for `/api/projects`. Unknown keys are rejected, not ignored. */
export const ProjectQuerySchema = z.strictObject({
  stack: z.string().trim().min(1).max(40).optional(),
});

/** Strip ASCII control characters except tab/newline: they have no place in a message. */
// deno-lint-ignore no-control-regex -- matching control characters is the point.
const clean = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

/** Contact form. `website` is a honeypot that real visitors never see or fill. */
export const ContactSchema = z.strictObject({
  name: z.string().transform(clean).pipe(
    z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
  ),
  email: z.string().trim().max(254).pipe(z.email("Enter an email address like name@example.com.")),
  message: z.string().transform(clean).pipe(
    z.string().trim().min(10, "Write at least 10 characters.").max(
      4000,
      "Keep the message under 4000 characters.",
    ),
  ),
  website: z.string().max(200).optional().default(""),
});
export type Contact = z.infer<typeof ContactSchema>;
