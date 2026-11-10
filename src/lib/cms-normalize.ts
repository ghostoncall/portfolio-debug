/* eslint-disable @typescript-eslint/no-explicit-any */
// Legacy document normalization + cross-document reference integrity.
//
// Pure functions (no React, no DB). They turn whatever shape happens to be
// stored in a `published`/`staged` JSONB row into the current CMS document
// shape, preserving unknown legacy keys so nothing is silently dropped.
//
// Stable IDs are deterministic so SSR and the client agree without a DB call.

import type {
  Certificate,
  ExperienceEntry,
  Project,
  Skill,
  SkillCategory,
  SkillsPageContent,
} from "@/content/site";
import type { MediaItem } from "@/components/media";

/** Turn an arbitrary seed string into a slug-safe, deterministic ID. */
export function stableId(prefix: string, seed: string): string {
  const slug = seed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug || "item"}`;
}

/** Next sort value after the given items (max + 1). */
export function nextSort(items: Array<{ sort?: number }>): number {
  return items.reduce((m, i) => Math.max(m, Number(i.sort ?? 0)), 0) + 1;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export function normalizeProject(raw: unknown): Project {
  const r = (raw as any) ?? {};
  return {
    ...r, // preserve unknown legacy keys
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    dek: String(r.dek ?? ""),
    year: String(r.year ?? new Date().getFullYear()),
    category: String(r.category ?? ""),
    stack: Array.isArray(r.stack) ? r.stack.filter((s: unknown) => typeof s === "string") : [],
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    summary: r.summary !== undefined ? String(r.summary) : undefined,
    status: r.status !== undefined ? r.status : undefined,
    featured: r.featured !== undefined ? Boolean(r.featured) : undefined,
    priority: r.priority !== undefined ? Number(r.priority) : undefined,
    duration: r.duration !== undefined ? String(r.duration) : undefined,
    role: r.role !== undefined ? String(r.role) : undefined,
    achievements:
      r.achievements !== undefined
        ? Array.isArray(r.achievements)
          ? r.achievements.filter(Boolean)
          : []
        : undefined,
    challenges: r.challenges !== undefined ? String(r.challenges) : undefined,
    thumbnail: r.thumbnail !== undefined ? r.thumbnail : undefined,
    cover: r.cover !== undefined ? r.cover : undefined,
    gallery: r.gallery !== undefined ? (Array.isArray(r.gallery) ? r.gallery : []) : undefined,
    video: r.video !== undefined ? r.video : undefined,
    links: r.links !== undefined ? (Array.isArray(r.links) ? r.links : []) : undefined,
    skillIds:
      r.skillIds !== undefined
        ? Array.isArray(r.skillIds)
          ? r.skillIds.filter(Boolean)
          : []
        : undefined,
    createdAt: r.createdAt !== undefined ? String(r.createdAt) : undefined,
    updatedAt: r.updatedAt !== undefined ? String(r.updatedAt) : undefined,
  } as Project;
}

// ---------------------------------------------------------------------------
// Skills page
// ---------------------------------------------------------------------------

function categoryFromGroup(group: any): SkillCategory {
  const id = stableId("cat", String(group.group ?? ""));
  return { id, name: String(group.group ?? ""), sort: 0, visible: true };
}

function skillFromItem(group: any, item: any, index: number): Skill {
  const catId = stableId("cat", String(group.group ?? ""));
  return {
    id: stableId("skill", `${String(group.group ?? "")} ${String(item.name ?? "")}`),
    name: String(item.name ?? ""),
    categoryId: catId,
    detail: item.detail ?? undefined,
    visible: true,
    sort: index,
  };
}

export function normalizeSkillsPage(raw: unknown): SkillsPageContent {
  const r = (raw as any) ?? {};

  // Already in the new shape: top-level categories + skills arrays.
  // (kind may be set on the pages table column but not inside the JSONB;
  // getPublishedSkillsBundle passes it via normalizePageContent, but
  // useCmsDraft calls normalizeSkillsPage directly, so we key off the
  // array shape rather than the kind field.)
  if (Array.isArray(r.categories) && Array.isArray(r.skills)) {
    return {
      kind: "skills",
      categories: r.categories.map((c: any) => ({
        id: c.id ?? stableId("cat", String(c.name ?? "")),
        name: String(c.name ?? ""),
        sort: Number(c.sort ?? 0),
        visible: c.visible !== false,
      })),
      skills: r.skills.map((s: any, i: number) => ({
        id: s.id ?? stableId("skill", `${String(s.categoryId ?? "")} ${String(s.name ?? "")}`),
        name: String(s.name ?? ""),
        categoryId: s.categoryId ?? "",
        detail: s.detail ?? undefined,
        description: s.description ?? undefined,
        level: s.level ?? undefined,
        years: s.years !== undefined ? Number(s.years) : undefined,
        icon: s.icon ?? undefined,
        featured: Boolean(s.featured),
        visible: s.visible !== false,
        projectSlugs: Array.isArray(s.projectSlugs) ? s.projectSlugs.filter(Boolean) : [],
        sort: Number(s.sort ?? i),
      })),
    } as SkillsPageContent;
  }

  // Legacy: { skills: [{ group, items: [{name, detail}] }] }.
  const groups = Array.isArray(r.skills) ? r.skills : [];
  const categories: SkillCategory[] = [];
  const skills: Skill[] = [];
  groups.forEach((group: any, gIdx: number) => {
    const cat = categoryFromGroup(group);
    cat.sort = gIdx;
    categories.push(cat);
    const items = Array.isArray(group.items) ? group.items : [];
    items.forEach((item: any, iIdx: number) => {
      skills.push(skillFromItem(group, item, skills.length));
    });
  });
  return { kind: "skills", categories, skills };
}

// ---------------------------------------------------------------------------
// Certificates page
// ---------------------------------------------------------------------------

function certificateFromFileBlock(block: any, index: number): Certificate {
  return {
    id: stableId("cert", String(block.name ?? `certificate-${index}`)),
    title: String(block.name ?? ""),
    issuer: String(block.issuer ?? ""),
    issueDate: block.issueDate ?? undefined,
    expiryDate: block.expiryDate ?? undefined,
    credentialId: block.credentialId ?? undefined,
    credentialUrl: block.credentialUrl ?? undefined,
    description: block.description ?? undefined,
    category: block.category ?? undefined,
    featured: Boolean(block.featured),
    visible: block.visible !== false,
    sort: index,
    image: block.image ?? undefined,
    file: block.file ?? undefined,
    skillIds: Array.isArray(block.skillIds) ? block.skillIds.filter(Boolean) : [],
  };
}

export function normalizeCertificatesPage(raw: unknown): {
  kind: "certificates";
  certificates: Certificate[];
} {
  const r = (raw as any) ?? {};

  if (Array.isArray(r.certificates)) {
    return {
      kind: "certificates",
      certificates: r.certificates.map((c: any, i: number) => ({
        id: c.id ?? stableId("cert", String(c.title ?? c.name ?? `certificate-${i}`)),
        title: String(c.title ?? c.name ?? ""),
        issuer: String(c.issuer ?? ""),
        issueDate: c.issueDate ?? undefined,
        expiryDate: c.expiryDate ?? undefined,
        credentialId: c.credentialId ?? undefined,
        credentialUrl: c.credentialUrl ?? undefined,
        description: c.description ?? undefined,
        category: c.category ?? undefined,
        featured: Boolean(c.featured),
        visible: c.visible !== false,
        sort: c.sort !== undefined ? Number(c.sort) : i,
        image: c.image ?? undefined,
        file: c.file ?? undefined,
        skillIds: Array.isArray(c.skillIds) ? c.skillIds.filter(Boolean) : [],
      })),
    };
  }

  // Legacy: certificates stored as `file` blocks inside the skills document.
  const blocks = Array.isArray(r.certificates) ? r.certificates : [];
  return {
    kind: "certificates",
    certificates: blocks.map((b: any, i: number) => certificateFromFileBlock(b, i)),
  };
}

// ---------------------------------------------------------------------------
// Experience page
// ---------------------------------------------------------------------------

function normalizeEntry(entry: any, index: number): ExperienceEntry {
  const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
  const textBlocks = blocks.filter((b: any) => b.type === "text");
  const listBlocks = blocks.filter((b: any) => b.type === "list");
  const period = String(entry.period ?? "");

  const lifted: ExperienceEntry = {
    id:
      entry.id ??
      stableId("exp", `${String(entry.role ?? "")} ${String(entry.org ?? "")} ${index}`),
    role: String(entry.role ?? ""),
    org: String(entry.org ?? ""),
    employmentType: entry.employmentType ?? undefined,
    location: entry.location ?? undefined,
    workMode: entry.workMode ?? undefined,
    startDate: entry.startDate ?? undefined,
    endDate: entry.endDate ?? undefined,
    current: entry.current ?? period.toLowerCase().includes("present"),
    period,
    overview: entry.overview ?? undefined,
    responsibilities: Array.isArray(entry.responsibilities)
      ? entry.responsibilities.filter(Boolean)
      : undefined,
    achievements: entry.achievements ?? undefined,
    tech: Array.isArray(entry.tech) ? entry.tech.filter(Boolean) : undefined,
    skillIds: Array.isArray(entry.skillIds) ? entry.skillIds.filter(Boolean) : undefined,
    projectSlugs: Array.isArray(entry.projectSlugs)
      ? entry.projectSlugs.filter(Boolean)
      : undefined,
    logo: entry.logo ?? undefined,
    website: entry.website ?? undefined,
    links: Array.isArray(entry.links) ? entry.links : undefined,
    media: Array.isArray(entry.media) ? entry.media : undefined,
    visible: entry.visible !== false,
    sort: Number(entry.sort ?? index),
  };

  // Lift a single text block into overview, a single list block into achievements.

  // Lift a single text block into overview, a single list block into achievements.
  if (!lifted.overview && textBlocks.length === 1) {
    lifted.overview = String((textBlocks[0] as any).body ?? "");
  }
  if (!lifted.achievements && listBlocks.length === 1) {
    const items = (listBlocks[0] as any).items ?? [];
    lifted.achievements = Array.isArray(items) ? items.filter(Boolean) : [];
  }

  // Preserve anything not lifted.
  const unmapped = blocks.filter((b: any) => b.type !== "text" && b.type !== "list");
  if (unmapped.length) {
    lifted.blocks = unmapped;
  } else if (!lifted.overview && !lifted.achievements && blocks.length) {
    // Nothing was lifted; keep original blocks so nothing is lost.
    lifted.blocks = blocks;
  }

  return lifted;
}

export function normalizeExperiencePage(raw: unknown): {
  kind: "experience";
  entries: ExperienceEntry[];
} {
  const r = (raw as any) ?? {};

  if (r.kind === "experience" && Array.isArray(r.entries)) {
    return {
      kind: "experience",
      entries: r.entries.map((e: any, i: number) => normalizeEntry(e, i)),
    };
  }

  // Legacy top-level: { entries: [{ role, org, period, blocks }] } without kind.
  const entries = Array.isArray(r.entries) ? r.entries : [];
  return {
    kind: "experience",
    entries: entries.map((e: any, i: number) => normalizeEntry(e, i)),
  };
}

// ---------------------------------------------------------------------------
// Generic entry point
// ---------------------------------------------------------------------------

export function normalizePageContent(kind: any, raw: unknown): any {
  switch (kind) {
    case "skills":
      return normalizeSkillsPage(raw);
    case "certificates":
      return normalizeCertificatesPage(raw);
    case "experience":
      return normalizeExperiencePage(raw);
    case "blocks":
    default:
      return {
        kind: "blocks",
        blocks: Array.isArray((raw as any)?.blocks) ? (raw as any).blocks : [],
      };
  }
}

// ---------------------------------------------------------------------------
// Cross-document reference integrity (pure)
// ---------------------------------------------------------------------------

function walk(value: any, fn: (node: any, key: string | number, parent: any) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, fn));
    return;
  }
  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => walk((value as any)[key], fn));
    fn(value, "root", undefined);
  }
}

function removeFromArrays(doc: any, field: string, values: Set<string>): boolean {
  let changed = false;
  if (Array.isArray(doc[field])) {
    const before = doc[field].length;
    doc[field] = doc[field].filter((v: any) => !values.has(String(v)));
    changed = doc[field].length !== before;
  }
  return changed;
}

/** Deep-clone a plain JSON document so inputs are never mutated. */
function cloneDoc(doc: unknown): unknown {
  return structuredClone(doc);
}

export function removeSkillReferences(
  doc: unknown,
  ids: string[],
): { doc: unknown; changed: boolean } {
  const value = ids.length ? new Set(ids) : new Set<string>();
  if (!value.size) return { doc, changed: false };
  const target = cloneDoc(doc);
  let changed = false;
  function remove(node: any, key: string | number) {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      if (Array.isArray(node.skillIds)) {
        const before = node.skillIds.length;
        node.skillIds = node.skillIds.filter((id: string) => !value.has(id));
        if (node.skillIds.length !== before) changed = true;
      }
    }
  }
  walk(target, remove);
  return { doc: target, changed };
}

export function removeCertificateReferences(
  doc: unknown,
  ids: string[],
): { doc: unknown; changed: boolean } {
  const value = ids.length ? new Set(ids) : new Set<string>();
  if (!value.size) return { doc, changed: false };
  const target = cloneDoc(doc);
  let changed = false;
  function remove(node: any, key: string | number) {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      if (Array.isArray(node.certificateIds)) {
        const before = node.certificateIds.length;
        node.certificateIds = node.certificateIds.filter((id: string) => !value.has(id));
        if (node.certificateIds.length !== before) changed = true;
      }
    }
  }
  walk(target, remove);
  return { doc: target, changed };
}

export function removeProjectReferences(
  doc: unknown,
  slugs: string[],
): { doc: unknown; changed: boolean } {
  const value = slugs.length ? new Set(slugs) : new Set<string>();
  if (!value.size) return { doc, changed: false };
  const target = cloneDoc(doc);
  let changed = false;
  function remove(node: any, key: string | number) {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      if (Array.isArray(node.projectSlugs)) {
        const before = node.projectSlugs.length;
        node.projectSlugs = node.projectSlugs.filter((s: string) => !value.has(s));
        if (node.projectSlugs.length !== before) changed = true;
      }
    }
  }
  walk(target, remove);
  return { doc: target, changed };
}

export function replaceProjectSlug(
  doc: unknown,
  oldSlug: string,
  newSlug: string,
): { doc: unknown; changed: boolean } {
  if (!oldSlug || oldSlug === newSlug) return { doc, changed: false };
  const target = cloneDoc(doc);
  let changed = false;
  function replace(node: any, key: string | number) {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      if (Array.isArray(node.projectSlugs)) {
        const before = node.projectSlugs.join("\u0000");
        node.projectSlugs = node.projectSlugs.map((s: string) => (s === oldSlug ? newSlug : s));
        if (node.projectSlugs.join("\u0000") !== before) changed = true;
      }
    }
  }
  walk(target, replace);
  // Also rename a top-level slug field if present.
  if (
    target &&
    typeof target === "object" &&
    !Array.isArray(target) &&
    (target as any).slug === oldSlug
  ) {
    (target as any).slug = newSlug;
    changed = true;
  }
  return { doc: target, changed };
}
