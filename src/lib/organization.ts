import { z } from "zod";

import { RESERVED_SLUGS } from "@/lib/routes";

export const orgNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(50, "Use at most 50 characters.");

export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(40, "Use at most 40 characters.")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Use lowercase letters, numbers and dashes.")
  .refine((slug) => !slug.includes("--"), "Use single dashes.")
  .refine((slug) => !RESERVED_SLUGS.has(slug), "This URL is reserved. Try another.");

/** Turns a name into a URL-friendly slug suggestion: "Acme Design Co." → "acme-design-co". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
