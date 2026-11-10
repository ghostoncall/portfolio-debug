// Database schema for the /onlyme content system.
//
// Staging & publish model: every editable piece of content keeps TWO copies.
//   `published` — what the public site serves
//   `staged`    — what the admin is currently editing
//
//   Edit    → writes to `staged` only
//   Publish → copies `staged` → `published`, stamps `published_at`,
//             sets `is_public` (new rows start hidden)
//   Revert  → discards staging by copying `published` back to `staged`
//   Delete  → removes the row entirely
//
// Content is stored as JSONB docs that mirror the shapes in
// src/content/site.ts, so site.ts remains the seed source and the
// types stay in one family.

import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  Block,
  CertificatesPageContent,
  ExperiencePageContent,
  PageContent,
  PageKind,
  Post,
  Project,
  SkillsPageContent,
} from "@/content/site";
import type { BlogSettings } from "@/lib/blog-settings";

/** Postgres tsvector. Maintained by a database trigger, never written by the app. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/** Global site identity — the Settings card in /onlyme.
 * Structurally identical to `site` in src/content/site.ts. */
export type SiteIdentity = {
  name: string;
  title: string;
  edition: string;
  email: string;
  socials: { label: string; href: string }[];
};

/** Legacy skill group shape (pre-CMS). Kept so old documents still typecheck. */
export type SkillGroup = {
  group: string;
  items: { name: string; detail: string }[];
};

/** Legacy experience entry shape (pre-CMS). Kept so old documents still typecheck. */
export type LegacyExperienceEntry = {
  role: string;
  org: string;
  period: string;
  blocks: Block[];
};

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(), // "overview" | "skills" | "experience" | "certificates"
  title: text("title").notNull(),
  kind: text("kind", { enum: ["blocks", "skills", "experience", "certificates"] })
    .$type<PageKind>()
    .notNull(),
  published: jsonb("published").$type<PageContent>().notNull(),
  staged: jsonb("staged").$type<PageContent>().notNull(),
  sort: integer("sort").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  slug: text("slug").primaryKey(),
  // Full Project document (title, dek, year, category, stack, blocks…)
  published: jsonb("published").$type<Project>().notNull(),
  staged: jsonb("staged").$type<Project>().notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  "posts",
  {
    slug: text("slug").primaryKey(),
    // Full Post document (title, dek, date, tags, cover, blocks…)
    published: jsonb("published").$type<Post>().notNull(),
    staged: jsonb("staged").$type<Post>().notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    /** Scheduled snapshot pending: pg_cron copies staged → published at due time. */
    needsPublish: boolean("needs_publish").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Full-text search vector (title A / dek+tags B / body C). Trigger-maintained. */
    search: tsvector("search"),
    /** Plain-text concatenation of title/dek/tags/body for trigram fuzzy search. */
    searchText: text("search_text"),
  },
  (table) => [index("posts_search_idx").using("gin", table.search)],
);

/** Snapshot of a post's staged content. Created on publish and on demand. */
export const postRevisions = pgTable(
  "post_revisions",
  {
    id: text("id").primaryKey(),
    postSlug: text("post_slug").notNull(),
    title: text("title").notNull().default(""),
    content: jsonb("content").$type<Post>().notNull(),
    revisionNumber: integer("revision_number").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("post_revisions_slug_idx").on(table.postSlug, table.createdAt)],
);

/** Lightweight view counters, incremented once per visitor session per post. */
export const postViews = pgTable("post_views", {
  slug: text("slug").primaryKey(),
  views: integer("views").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Contact form submissions (honeypot-protected). Email delivery not configured. */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contact_messages_created_idx").on(table.createdAt)],
);

export const settings = pgTable("settings", {
  // Single row, id is always "site".
  id: text("id").primaryKey(),
  published: jsonb("published").$type<SiteIdentity>().notNull(),
  staged: jsonb("staged").$type<SiteIdentity>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  /** Object path inside the Supabase Storage `media` bucket (new uploads). */
  storagePath: text("storage_path"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  caption: text("caption"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Blog appearance + typography. Single row, id is always "blog".
 * Stored as one JSONB document so new settings can ship without migrations.
 */
export const blogSettings = pgTable("blog_settings", {
  id: text("id").primaryKey(),
  value: jsonb("value").$type<BlogSettings>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type BlogSettingsRow = typeof blogSettings.$inferSelect;
export type PostRevisionRow = typeof postRevisions.$inferSelect;
export type PostViewRow = typeof postViews.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;

export type PageRow = typeof pages.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;

// Re-export CMS content types so consumers import from one place.
export type {
  Project,
  ProjectStatus,
  ProjectLink,
  Skill,
  SkillCategory,
  SkillLevel,
  Certificate,
  ExperienceEntry,
  ExperienceEmploymentType,
  ExperienceWorkMode,
  SkillsPageContent,
  CertificatesPageContent,
  ExperiencePageContent,
  PageContent,
  PageKind,
} from "@/content/site";
