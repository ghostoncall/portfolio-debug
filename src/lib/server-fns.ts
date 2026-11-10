/* eslint-disable @typescript-eslint/no-explicit-any */
// Server functions for the /onlyme admin panel.
//
// Every function checks the admin session before touching the database.
// The client passes input via `data`; the server receives it in the handler
// context along with the Request for session verification.

import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getAuthUser, getSupabaseServer } from "@/lib/supabase.server";
import {
  blogSettings,
  contactMessages,
  mediaAssets,
  pages,
  postRevisions,
  posts,
  projects,
  settings,
} from "@/db/schema";
import type {
  CertificatesPageContent,
  PageContent,
  PageKind,
  PageRow,
  Project,
  SiteIdentity,
  SkillsPageContent,
} from "@/db/schema";
import { assertValidContent } from "@/lib/cms-validation";
import {
  normalizeCertificatesPage,
  normalizeExperiencePage,
  normalizePageContent,
  normalizeProject,
  normalizeSkillsPage,
  nextSort,
} from "@/lib/cms-normalize";
import { planPageReferenceCleanup, planProjectDelete, planProjectRename } from "@/lib/cms-server";
import { mergeBlogSettings } from "@/lib/blog-settings";

/** Verify the Supabase session on a Request. Throws 401 if invalid. */
async function requireAdmin(request: Request): Promise<void> {
  const user = await getAuthUser(request);
  if (!user) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

/** Settings rows key on `id`; content rows key on `slug`. */
function keyColumn(table: any) {
  return table.slug ?? table.id;
}

/** Per-file upload ceiling. Supabase Storage enforces the same value. */
export function mediaMaxBytes(): number {
  const configured = Number((import.meta.env as any).VITE_MEDIA_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 50 * 1024 * 1024;
}

type TableKey = "pages" | "projects" | "posts" | "settings";
const TABLES: Record<TableKey, any> = {
  pages,
  projects,
  posts,
  settings,
};

// ---------------------------------------------------------------------------
// List all items in a table (for admin index views)
// ---------------------------------------------------------------------------

export const listStaged = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const rows = await db.select().from(table).orderBy(table.sort);
    // Drizzle exposes camelCase properties; settings rows have no `slug`.
    return rows.map((r: any) => ({
      slug: r.slug ?? r.id,
      published: r.published,
      staged: r.staged,
      sort: r.sort,
      isPublic: r.isPublic ?? false,
      publishedAt: r.publishedAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  },
);

// ---------------------------------------------------------------------------
// Read staged content for a single item
// ---------------------------------------------------------------------------

export const getStaged = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    return {
      published: row[0]["published"],
      staged: row[0]["staged"],
      isPublic: row[0]["isPublic"] ?? false,
      publishedAt: row[0]["publishedAt"]?.toISOString?.() ?? null,
      updatedAt: row[0]["updatedAt"]?.toISOString?.() ?? null,
    };
  },
);

// ---------------------------------------------------------------------------
// Write (edit staged copy)
// ---------------------------------------------------------------------------

export const updateStaged = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const now = new Date();
    try {
      assertValidContent(data.table, data.content);
    } catch (err: any) {
      if (!err.statusCode) {
        const wrapped: any = new Error(err?.message ?? "Validation failed");
        wrapped.statusCode = 400;
        throw wrapped;
      }
      throw err;
    }
    if (data.table === "pages") {
      await db
        .update(pages)
        .set({ staged: data.content, updatedAt: now })
        .where(eq(pages.slug, data.slug));
      return { ok: true };
    }
    await db
      .update(table)
      .set({ staged: data.content, updatedAt: now })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Publish (copy staged → published)
// ---------------------------------------------------------------------------

export const createItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const slug = String(data.slug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      const err: any = new Error(
        "Slug must be lowercase letters, numbers, and dashes (e.g. my-first-post)",
      );
      err.statusCode = 400;
      throw err;
    }
    const existing = await db.select().from(table).where(eq(table.slug, slug)).limit(1);
    if (existing[0]) {
      const err: any = new Error(`"${slug}" already exists — pick another slug`);
      err.statusCode = 409;
      throw err;
    }
    const now = new Date();
    let doc: any;
    if (data.table === "posts") {
      doc = {
        slug,
        title: String(data.title ?? "").trim() || "Untitled post",
        dek: "",
        date: now.toISOString().slice(0, 10),
        tags: [],
        blocks: [],
      };
    } else if (data.table === "projects") {
      doc = {
        slug,
        title: String(data.title ?? "").trim() || "Untitled project",
        dek: "",
        year: String(now.getFullYear()),
        category: "",
        stack: [],
        blocks: [],
      };
    } else if (data.table === "pages") {
      doc = { kind: "blocks", blocks: [] };
    } else {
      const err: any = new Error("Unsupported table for creation");
      err.statusCode = 400;
      throw err;
    }
    const values: any = { slug, published: doc, staged: doc, sort: 0, updatedAt: now };
    if (data.table === "posts" || data.table === "projects") {
      values.isPublic = false; // hidden until published
    }
    await db.insert(table).values(values);
    return { ok: true, slug };
  },
);

export const deleteItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    await db.delete(table).where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

/** Rename a post URL. The slug is the primary key, so it updates in place. */
export const updatePostSlug = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const oldSlug = String(data?.oldSlug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Slug must be lowercase letters, numbers, and dashes.", 400);
    }
    if (newSlug === oldSlug) return { ok: true, slug: newSlug };
    const existing = await db.select().from(posts).where(eq(posts.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);

    const row = await db.select().from(posts).where(eq(posts.slug, oldSlug)).limit(1);
    if (!row[0]) throw httpError("Post not found", 404);
    await db
      .update(posts)
      .set({
        slug: newSlug,
        published: { ...row[0].published, slug: newSlug },
        staged: { ...row[0].staged, slug: newSlug },
        updatedAt: new Date(),
      })
      .where(eq(posts.slug, oldSlug));
    return { ok: true, slug: newSlug };
  },
);

/** Bulk publish / unpublish / delete for the blog list. */
export const bulkUpdatePosts = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const action = String(data?.action ?? "");
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    let count = 0;

    for (const slug of slugs) {
      if (action === "delete") {
        await db.delete(posts).where(eq(posts.slug, slug));
        count += 1;
        continue;
      }
      const row = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
      if (!row[0]) continue;
      if (action === "publish") {
        await db
          .update(posts)
          .set({ published: row[0].staged, publishedAt: now, isPublic: true, updatedAt: now })
          .where(eq(posts.slug, slug));
        count += 1;
      } else if (action === "unpublish") {
        await db.update(posts).set({ isPublic: false, updatedAt: now }).where(eq(posts.slug, slug));
        count += 1;
      }
    }
    return { ok: true, count };
  },
);

export const publishItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const now = new Date();
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    let when = now;
    if (data.publishAt) {
      const parsed = new Date(data.publishAt);
      if (Number.isNaN(parsed.getTime())) {
        const err: any = new Error("Invalid publish date");
        err.statusCode = 400;
        throw err;
      }
      when = parsed;
    }
    const setValues: any = {
      published: row[0]["staged"],
      publishedAt: when,
      updatedAt: now,
    };
    if (data.table === "posts" || data.table === "projects") {
      setValues.isPublic = true; // publishing makes the item live
    }
    if (data.table === "posts" && data.publishAt) {
      setValues.needsPublish = true; // pg_cron publishes at the scheduled time
    }
    await db
      .update(table)
      .set(setValues)
      .where(eq(keyColumn(table), data.slug));
    return { ok: true, publishedAt: when.toISOString() };
  },
);

/** Take a post/project off the public site without discarding the published copy. */
export const unpublishItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    await db
      .update(table)
      .set({ isPublic: false, updatedAt: new Date() })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

export const revertItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    await db
      .update(table)
      .set({ staged: row[0]["published"], updatedAt: new Date() })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Project-specific operations (slug rename, duplicate, reorder, delete)
// ---------------------------------------------------------------------------

export const updateProjectSlug = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const oldSlug = String(data?.oldSlug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Slug must be lowercase letters, numbers, and dashes.", 400);
    }
    if (newSlug === oldSlug) return { ok: true, slug: newSlug };
    const existing = await db.select().from(projects).where(eq(projects.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);
    const row = await db.select().from(projects).where(eq(projects.slug, oldSlug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const allPages = await db.select().from(pages);
    const plan = planProjectRename({
      project: row[0].staged as Project,
      pages: allPages as PageRow[],
      oldSlug,
      newSlug,
    });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          slug: newSlug,
          published: { ...plan.project, slug: newSlug } as Project,
          staged: plan.project,
          updatedAt: now,
        })
        .where(eq(projects.slug, oldSlug));
      for (const p of plan.pages) {
        await tx
          .update(pages)
          .set({ published: p.published, staged: p.staged, updatedAt: now })
          .where(eq(pages.slug, p.slug));
      }
    });
    return { ok: true, slug: newSlug };
  },
);

export const duplicateProject = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    const newTitle = String(data?.title ?? "").trim() || "Copy";
    if (!newSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Invalid slug", 400);
    }
    const existing = await db.select().from(projects).where(eq(projects.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);
    const row = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const all = await db.select().from(projects);
    const maxSort = all.reduce((m, p) => Math.max(m, p.sort ?? 0), 0);
    const now = new Date();
    const staged = normalizeProject({
      ...row[0].staged,
      slug: newSlug,
      title: newTitle,
      featured: false,
      updatedAt: now.toISOString(),
    });
    await db.insert(projects).values({
      slug: newSlug,
      published: staged,
      staged,
      sort: maxSort + 1,
      isPublic: false,
      updatedAt: now,
    });
    return { ok: true, slug: newSlug };
  },
);

export const reorderProjects = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    await db.transaction(async (tx) => {
      for (let i = 0; i < slugs.length; i++) {
        await tx
          .update(projects)
          .set({ sort: i, updatedAt: now })
          .where(eq(projects.slug, slugs[i]!));
      }
    });
    return { ok: true, count: slugs.length };
  },
);

export const deleteProject = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const row = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const allPages = await db.select().from(pages);
    const plan = planProjectDelete({ pages: allPages as PageRow[], slug });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(projects).where(eq(projects.slug, slug));
      for (const p of plan) {
        await tx
          .update(pages)
          .set({ published: p.published, staged: p.staged, updatedAt: now })
          .where(eq(pages.slug, p.slug));
      }
    });
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Content-page helpers
// ---------------------------------------------------------------------------

export const ensureContentPage = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const title = String(data?.title ?? slug).trim();
    const kind = (data?.kind ?? "blocks") as PageKind;
    if (!slug) throw httpError("slug is required", 400);
    const existing = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    if (existing[0]) return { ok: true, created: false, slug };
    const now = new Date();
    const empty: PageContent =
      kind === "skills"
        ? { kind: "skills", categories: [], skills: [] }
        : kind === "certificates"
          ? { kind: "certificates", certificates: [] }
          : { kind: "experience", entries: [] };
    await db.insert(pages).values({
      slug,
      title,
      kind,
      published: empty,
      staged: empty,
      sort: 99,
      updatedAt: now,
    });
    return { ok: true, created: true, slug };
  },
);

export const getPublishedSkillsBundle = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const skillsRow = await db.select().from(pages).where(eq(pages.slug, "skills")).limit(1);
    const certsRow = await db.select().from(pages).where(eq(pages.slug, "certificates")).limit(1);
    const skills = skillsRow[0]
      ? normalizePageContent(skillsRow[0].published.kind, skillsRow[0].published)
      : { kind: "skills", categories: [], skills: [] };
    const certificates = certsRow[0]
      ? normalizePageContent(certsRow[0].published.kind, certsRow[0].published)
      : { kind: "certificates", certificates: [] };
    return {
      skills: skills as SkillsPageContent,
      certificates: certificates as CertificatesPageContent,
    };
  },
);

export const publishAll = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }) => {
    const { request } = context as any;
    await requireAdmin(request);
    const db = getDb();
    const now = new Date();
    await db.update(pages).set({ published: pages.staged, publishedAt: now, updatedAt: now });
    await db.update(projects).set({ published: projects.staged, publishedAt: now, updatedAt: now });
    await db.update(posts).set({ published: posts.staged, publishedAt: now, updatedAt: now });
    await db.update(settings).set({ published: settings.staged, updatedAt: now });
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Public content access (no admin required)
// ---------------------------------------------------------------------------

export const getSiteIdentity = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const row = await db.select().from(settings).where(eq(settings.id, "site")).limit(1);
    return (
      row[0]?.published ?? {
        name: "Portfolio",
        title: "AI Engineer",
        edition: "2026",
        email: "",
        socials: [],
      }
    );
  },
);

// ---------------------------------------------------------------------------
// Blog appearance settings
// ---------------------------------------------------------------------------

export const getBlogSettings = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const row = await db.select().from(blogSettings).where(eq(blogSettings.id, "blog")).limit(1);
    return mergeBlogSettings(row[0]?.value ?? {});
  },
);

export const saveBlogSettings = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const value = mergeBlogSettings(data?.settings ?? {});
    await db
      .insert(blogSettings)
      .values({ id: "blog", value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: blogSettings.id,
        set: { value, updatedAt: new Date() },
      });
    return { ok: true, settings: value };
  },
);

export const getPublishedPosts = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const now = new Date();
    const rows = await db
      .select()
      .from(posts)
      .where(
        and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
      )
      .orderBy(posts.sort);
    return rows.map((r) => r.published).filter((p) => (p.visibility ?? "public") === "public");
  },
);

export const getPublishedPost = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const row = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);
    if (!row[0] || !row[0].isPublic) return null;
    // Scheduled posts stay hidden until their publish time.
    if (row[0].publishedAt && row[0].publishedAt.getTime() > Date.now()) return null;
    const post = row[0].published;
    if ((post.visibility ?? "public") === "private") return null;
    return post;
  },
);

/**
 * Admin preview: the staged copy regardless of status. `published` is returned
 * so the preview can show "compared to live" state.
 */
export const getPostPreview = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const row = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);
    if (!row[0]) return null;
    return {
      staged: row[0].staged,
      published: row[0].published,
      isPublic: row[0].isPublic,
      publishedAt: row[0].publishedAt?.toISOString() ?? null,
    };
  },
);

// ---------------------------------------------------------------------------
// Search (PostgreSQL full text + trigram fuzzy fallback, RPC-enforced visibility)
// ---------------------------------------------------------------------------

export const searchPosts = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const rows: any[] = await db.execute(sql`
      select * from search_blog_posts(
        ${data?.query ?? null},
        ${data?.tag ?? null},
        ${data?.year ?? null},
        ${data?.featured ?? null},
        ${data?.sort ?? "relevance"},
        ${data?.page ?? 1},
        ${data?.perPage ?? 10}
      )
    `);
    return {
      posts: rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        dek: r.dek,
        date: r.date,
        tags: r.tags,
        cover: r.cover,
        readTime: r.read_time,
        author: r.author,
        featured: r.featured,
        publishedAt: r.published_at,
      })),
      rank: rows.map((r) => r.rank),
      headline: rows.map((r) => r.headline),
      total: rows.length ? Number(rows[0].total) : 0,
    };
  },
);

export const searchSuggest = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const rows: any[] = await db.execute(sql`
      select * from search_blog_suggest(${data?.query ?? ""}, ${data?.limit ?? 6})
    `);
    return rows;
  },
);

export const getBlogTags = createServerFn({ method: "GET", strict: false }).handler(async () => {
  const db = getDb();
  return await db.execute(sql`select * from get_blog_tags()`);
});

export const getRelatedPosts = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const rows: any[] = await db.execute(sql`
      select * from get_related_posts(${data?.slug ?? ""}, ${data?.limit ?? 3})
    `);
    return rows.map((r) => ({
      slug: r.out_slug,
      title: r.out_title,
      dek: r.out_dek,
      date: r.out_date,
      tags: r.out_tags,
      cover: r.out_cover,
      readTime: r.out_read_time,
      author: r.out_author,
      featured: r.out_featured,
      publishedAt: r.out_published_at,
    }));
  },
);

// ---------------------------------------------------------------------------
// Analytics: once-per-session view counting
// ---------------------------------------------------------------------------

export const recordPostView = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const row: any = await db.execute(sql`select record_post_view(${data?.slug ?? ""}) as views`);
    return { views: row[0]?.views ?? null };
  },
);

// ---------------------------------------------------------------------------
// Blog overview (dashboard)
// ---------------------------------------------------------------------------

export const getBlogOverview = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const row: any = await db.execute(sql`select get_blog_overview() as overview`);
    return row[0]?.overview ?? {};
  },
);

// ---------------------------------------------------------------------------
// Revision history
// ---------------------------------------------------------------------------

export const listPostRevisions = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.postSlug, data.slug))
      .orderBy(postRevisions.revisionNumber);
  },
);

export const createPostRevision = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const row = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    const last = await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.postSlug, data.slug))
      .orderBy(postRevisions.revisionNumber)
      .limit(1);
    const nextNum = last[0] ? (last[0].revisionNumber as number) + 1 : 1;
    const id = crypto.randomUUID();
    await db.insert(postRevisions).values({
      id,
      postSlug: data.slug,
      title: data.title ?? row[0].published.title,
      content: data.content ?? row[0].staged,
      revisionNumber: nextNum,
    });
    return { ok: true, id, revisionNumber: nextNum };
  },
);

export const restorePostRevision = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const rev = await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.id, data.revisionId))
      .limit(1);
    if (!rev[0]) {
      const err: any = new Error("Revision not found");
      err.statusCode = 404;
      throw err;
    }
    // Restore to staged only — never silently overwrites newer edits.
    await db
      .update(posts)
      .set({ staged: rev[0].content, updatedAt: new Date() })
      .where(eq(posts.slug, rev[0].postSlug));
    return { ok: true, slug: rev[0].postSlug };
  },
);

// ---------------------------------------------------------------------------
// Contact inbox
// ---------------------------------------------------------------------------

export const submitContact = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const name = String(data?.name ?? "")
      .trim()
      .slice(0, 200);
    const email = String(data?.email ?? "")
      .trim()
      .slice(0, 320);
    const message = String(data?.message ?? "")
      .trim()
      .slice(0, 10000);
    const honeypot = data?.website ?? "";
    if (honeypot) {
      // Bot trap filled in — silently accept but do not store.
      return { ok: true, skipped: true };
    }
    if (!name || !email || !message) {
      const err: any = new Error("Missing required fields");
      err.statusCode = 400;
      throw err;
    }
    // Suppress near-duplicate submissions within 5 minutes.
    const recent = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.email, email))
      .orderBy(contactMessages.createdAt)
      .limit(1);
    if (
      recent[0] &&
      recent[0].message === message &&
      Date.now() - new Date(recent[0].createdAt).getTime() < 5 * 60 * 1000
    ) {
      return { ok: true, duplicate: true };
    }
    const id = crypto.randomUUID();
    await db.insert(contactMessages).values({ id, name, email, message, isRead: false });
    return { ok: true, id };
  },
);

export const listContactMessages = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db.select().from(contactMessages).orderBy(contactMessages.createdAt);
  },
);

export const markContactRead = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, data.id));
    return { ok: true };
  },
);

export const getPublishedProjects = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.isPublic, true))
      .orderBy(projects.sort);
    return rows.map((r) => r.published);
  },
);

export const getPublishedProject = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const row = await db.select().from(projects).where(eq(projects.slug, data.slug)).limit(1);
    if (!row[0]) return null;
    return row[0].published;
  },
);

export const getPublishedPage = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const row = await db.select().from(pages).where(eq(pages.slug, data.slug)).limit(1);
    if (!row[0]) return null;
    return row[0].published;
  },
);

export const exportBackup = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }) => {
    const { request } = context as any;
    await requireAdmin(request);
    const db = getDb();
    const [allPages, allProjects, allPosts, allSettings] = await Promise.all([
      db.select().from(pages),
      db.select().from(projects),
      db.select().from(posts),
      db.select().from(settings),
    ]);
    const backup = {
      exportedAt: new Date().toISOString(),
      pages: allPages.map((r: any) => ({ slug: r.slug, published: r.published, sort: r.sort })),
      projects: allProjects.map((r: any) => ({
        slug: r.slug,
        published: r.published,
        sort: r.sort,
      })),
      posts: allPosts.map((r: any) => ({ slug: r.slug, published: r.published, sort: r.sort })),
      settings: allSettings.map((r: any) => ({ id: r.id, published: r.published })),
    };
    return backup;
  },
);
// ---------------------------------------------------------------------------
// Media library
//
// Bytes live in Supabase Storage (bucket `media`), never inside a serverless
// request body: Vercel caps function request bodies at 4.5 MB, and Workers
// cap them at 100 MB. The browser uploads directly with a signed URL.
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = "media";

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
]);

function httpError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Every content document that could reference an asset URL. */
async function findMediaReferences(url: string): Promise<{ kind: string; ref: string }[]> {
  const db = getDb();
  const like = `%${url}%`;
  const result: any = await db.execute(sql`
    select 'post' as kind, slug as ref from posts
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'project' as kind, slug as ref from projects
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'page' as kind, slug as ref from pages
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'site settings' as kind, id as ref from settings
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'blog settings' as kind, id as ref from blog_settings
      where value::text like ${like}
  `);
  const rows = Array.isArray(result) ? result : (result?.rows ?? []);
  return rows as { kind: string; ref: string }[];
}

export const createMediaUpload = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();

    const name = String(data?.name ?? "upload").slice(0, 200);
    const type = String(data?.type ?? "");
    const size = Number(data?.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) throw httpError("File is empty", 400);
    if (size > mediaMaxBytes()) {
      throw httpError(
        `File is too large (${(size / 1024 / 1024).toFixed(1)} MB). Limit is ${(
          mediaMaxBytes() /
          1024 /
          1024
        ).toFixed(0)} MB.`,
        413,
      );
    }
    if (!ALLOWED_MEDIA_TYPES.has(type)) {
      throw httpError(`Unsupported file type: ${type || "unknown"}`, 415);
    }

    const id = crypto.randomUUID();
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "file";
    const storagePath = `${id}-${safeName}`;

    const supabase = getSupabaseServer(request);
    const { data: signed, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !signed) {
      throw httpError(
        `Storage is not configured: ${error?.message ?? "could not create upload URL"}`,
        500,
      );
    }
    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    const row = await db
      .insert(mediaAssets)
      .values({
        id,
        url: pub.publicUrl,
        name,
        type,
        size,
        storagePath,
        width: data?.width ? Number(data.width) : null,
        height: data?.height ? Number(data.height) : null,
        alt: typeof data?.alt === "string" ? data.alt : null,
        caption: typeof data?.caption === "string" ? data.caption : null,
        uploadedAt: new Date(),
      })
      .returning();

    return {
      asset: row[0],
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxBytes: mediaMaxBytes(),
    };
  },
);

export const listMedia = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db.select().from(mediaAssets).orderBy(mediaAssets.uploadedAt);
  },
);

export const updateMedia = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const id = String(data?.id ?? "");
    if (!id) throw httpError("Missing media id", 400);
    const patch: any = {};
    if (typeof data.alt === "string") patch.alt = data.alt;
    if (typeof data.caption === "string") patch.caption = data.caption;
    if (typeof data.name === "string" && data.name.trim()) patch.name = data.name.trim();
    if (!Object.keys(patch).length) return { ok: true };
    const row = await db.update(mediaAssets).set(patch).where(eq(mediaAssets.id, id)).returning();
    return { ok: true, asset: row[0] ?? null };
  },
);

export const getMediaUsage = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const id = String(data?.id ?? "");
    const db = getDb();
    const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!row[0]) return [];
    return findMediaReferences(row[0].url);
  },
);

export const deleteMedia = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const id = String(data?.id ?? "");
    if (!id) throw httpError("Missing media id", 400);

    const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!row[0]) throw httpError("Media not found", 404);
    const asset = row[0];

    const refs = await findMediaReferences(asset.url);
    if (refs.length) {
      const where = refs
        .slice(0, 4)
        .map((r) => `${r.kind} “${r.ref}”`)
        .join(", ");
      throw httpError(
        `This file is still used by ${where}${refs.length > 4 ? ` and ${refs.length - 4} more` : ""}. Remove it from those first.`,
        409,
      );
    }

    if (asset.storagePath) {
      const supabase = getSupabaseServer(request);
      const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([asset.storagePath]);
      if (error) throw httpError(`Could not remove file from storage: ${error.message}`, 500);
    }

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Session probe (used by the /onlyme route guard)
// ---------------------------------------------------------------------------

export const getAdminUser = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    const user = await getAuthUser(request);
    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  },
);
