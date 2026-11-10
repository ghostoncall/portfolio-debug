/* eslint-disable @typescript-eslint/no-explicit-any */
// Zod validation for CMS documents.
//
// Validates project, skills, certificates and experience documents before they
// are written to `staged`. Posts and settings are intentionally left untouched.

import { z } from "zod";
import type {
  Certificate,
  ExperienceEmploymentType,
  ExperienceEntry,
  ExperienceWorkMode,
  PageContent,
  PageKind,
  Project,
  ProjectLink,
  ProjectStatus,
  Skill,
  SkillCategory,
  SkillLevel,
  SkillsPageContent,
} from "@/content/site";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and dashes (e.g. my-first-project)",
  );

const requiredName = z.string().trim().min(1, "This field is required");

const isoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Must be a YYYY-MM-DD date");

const httpOrRelativeUrl = z
  .string()
  .trim()
  .refine((v) => {
    if (!v) return true;
    if (v.startsWith("/")) return true;
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid URL (http/https) or a relative path starting with /");

const projectLinkSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  href: httpOrRelativeUrl,
  kind: z.enum(["live", "github", "docs", "demo", "other"]),
});

// ---------------------------------------------------------------------------
// Project schema
// ---------------------------------------------------------------------------

export const projectSchema = z
  .object({
    slug: slugSchema,
    title: requiredName,
    dek: z.string().trim().min(1, "Dek is required"),
    year: z.string().trim().min(1, "Year is required"),
    category: requiredName,
    stack: z.array(z.string().trim()).default([]),
    summary: z.string().trim().optional(),
    status: z.enum(["completed", "in-progress", "upcoming", "archived"] as const).optional(),
    featured: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
    duration: z.string().trim().optional(),
    role: z.string().trim().optional(),
    achievements: z.array(z.string().trim()).optional(),
    challenges: z.string().trim().optional(),
    links: z.array(projectLinkSchema).default([]),
    skillIds: z.array(z.string().trim()).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough(); // preserve unknown legacy keys

export type ProjectInput = z.infer<typeof projectSchema>;

// ---------------------------------------------------------------------------
// Skill / category / certificate schemas
// ---------------------------------------------------------------------------

export const skillCategorySchema = z.object({
  id: z.string().trim().min(1),
  name: requiredName,
  sort: z.number().int().min(0).default(0),
  visible: z.boolean().optional(),
});

export const skillSchema = z.object({
  id: z.string().trim().min(1),
  name: requiredName,
  categoryId: z.string().trim().min(1, "Category is required"),
  detail: z.string().trim().optional(),
  description: z.string().trim().optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"] as const).optional(),
  years: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  visible: z.boolean().optional(),
  projectSlugs: z.array(z.string().trim()).default([]),
  sort: z.number().int().min(0).default(0),
});

export const certificateSchema = z.object({
  id: z.string().trim().min(1),
  title: requiredName,
  issuer: z.string().trim().optional(),
  issueDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
  credentialId: z.string().trim().optional(),
  credentialUrl: httpOrRelativeUrl.optional(),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  featured: z.boolean().optional(),
  visible: z.boolean().optional(),
  sort: z.number().int().min(0).default(0),
  skillIds: z.array(z.string().trim()).default([]),
});

// cross-field: expiry must not precede issue
export const certificateSchemaWithDates = certificateSchema.refine(
  (c) => {
    if (!c.issueDate || !c.expiryDate) return true;
    return c.expiryDate >= c.issueDate;
  },
  { path: ["expiryDate"], message: "Expiry date must not be earlier than issue date" },
);

export const skillsPageSchema = z
  .object({
    kind: z.literal("skills"),
    categories: z.array(skillCategorySchema),
    skills: z.array(skillSchema),
  })
  .superRefine((data, ctx) => {
    const categoryIds = new Set(data.categories.map((c) => c.id));
    for (let i = 0; i < data.skills.length; i++) {
      const skill = data.skills[i];
      if (!skill) continue;
      if (!categoryIds.has(skill.categoryId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Category "${skill.categoryId}" does not exist`,
          path: ["skills", i, "categoryId"],
        });
      }
    }
  });

export const certificatesPageSchema = z.object({
  kind: z.literal("certificates"),
  certificates: z.array(certificateSchemaWithDates),
});

// ---------------------------------------------------------------------------
// Experience schema
// ---------------------------------------------------------------------------

export const experienceEntrySchema = z.object({
  id: z.string().trim().min(1),
  role: requiredName,
  org: requiredName,
  employmentType: z
    .enum(["full-time", "part-time", "contract", "freelance", "internship"] as const)
    .optional(),
  location: z.string().trim().optional(),
  workMode: z.enum(["on-site", "remote", "hybrid"] as const).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  current: z.boolean().optional(),
  period: z.string().trim().optional(),
  overview: z.string().trim().optional(),
  responsibilities: z.array(z.string().trim()).optional(),
  achievements: z.array(z.string().trim()).optional(),
  tech: z.array(z.string().trim()).optional(),
  skillIds: z.array(z.string().trim()).optional(),
  projectSlugs: z.array(z.string().trim()).optional(),
  website: httpOrRelativeUrl.optional(),
  visible: z.boolean().optional(),
  sort: z.number().int().min(0).default(0),
});

export const experienceEntrySchemaWithDates = experienceEntrySchema
  .refine(
    (e) => {
      if (!e.current && e.endDate && e.startDate && e.endDate < e.startDate) {
        return false;
      }
      return true;
    },
    { path: ["endDate"], message: "End date must not be earlier than start date" },
  )
  .refine(
    (e) => {
      if (e.current && e.endDate) return false;
      return true;
    },
    { path: ["endDate"], message: "A current role cannot have an end date" },
  );

export const experiencePageSchema = z.object({
  kind: z.literal("experience"),
  entries: z.array(experienceEntrySchemaWithDates),
});

// ---------------------------------------------------------------------------
// Validation results
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  { ok: true; data: T } | { ok: false; errors: Record<string, string[]> };

function flattenZodError(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const i of error.issues) {
    const path = i.path
      .map((p: string | number) => (typeof p === "string" ? p : String(p)))
      .join(".");
    (errors[path] = errors[path] || []).push(i.message);
  }
  return errors;
}

export function validateProjectDoc(doc: unknown): ValidationResult<Project> {
  const result = projectSchema.safeParse(doc);
  if (!result.success) return { ok: false, errors: flattenZodError(result.error) };
  return { ok: true, data: result.data as Project };
}

export function validatePageDoc(kind: PageKind, doc: unknown): ValidationResult<PageContent> {
  let schema: z.ZodTypeAny;
  switch (kind) {
    case "skills":
      schema = skillsPageSchema;
      break;
    case "certificates":
      schema = certificatesPageSchema;
      break;
    case "experience":
      schema = experiencePageSchema;
      break;
    case "blocks":
    default:
      return { ok: true, data: doc as PageContent };
  }
  const result = schema.safeParse(doc);
  if (!result.success) return { ok: false, errors: flattenZodError(result.error) };
  return { ok: true, data: result.data as PageContent };
}

// ---------------------------------------------------------------------------
// Server-side enforcement
// ---------------------------------------------------------------------------

/** Throws a 400 error if the staged content for a content table is invalid.
 * Posts and settings are intentionally not validated here. */
export function assertValidContent(table: string, content: unknown): void {
  if (table === "posts" || table === "settings") return;
  if (table === "projects") {
    const result = validateProjectDoc(content);
    if (!result.ok) {
      const err: any = new Error(
        Object.entries(result.errors)
          .map(([path, msgs]) => `${path}: ${msgs.join("; ")}`)
          .join(" | "),
      );
      err.statusCode = 400;
      throw err;
    }
    return;
  }
  if (table === "pages") {
    const page = content as { kind?: PageKind };
    const result = validatePageDoc(page.kind ?? "blocks", content);
    if (!result.ok) {
      const err: any = new Error(
        Object.entries(result.errors)
          .map(([path, msgs]) => `${path}: ${msgs.join("; ")}`)
          .join(" | "),
      );
      err.statusCode = 400;
      throw err;
    }
  }
}
