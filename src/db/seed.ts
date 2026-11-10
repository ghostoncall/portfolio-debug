// One-shot seeding from src/content/site.ts.
//
// Fills empty tables only: existing rows are never overwritten, so re-running
// is always safe. Both copies (`published` and `staged`) receive identical
// content — the admin panel then starts from the current placeholders.
//
// First apply the schema, then:  npm run db:seed

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  certificates,
  experience,
  overview,
  posts as seedPosts,
  projects as seedProjects,
  site as siteIdentity,
  skills,
} from "../content/site";

import type { PageContent, PageKind } from "./schema";
import { pages, posts, projects, settings } from "./schema";
import { closeDb, getDb } from "./client";

export type SeedCounts = {
  pages: number;
  projects: number;
  posts: number;
  settings: number;
};

export async function seedContent(): Promise<SeedCounts> {
  const db = getDb();

  const pageCount = (
    await db
      .insert(pages)
      .values([
        {
          slug: "overview",
          title: "Overview",
          kind: "blocks" as PageKind,
          published: { kind: "blocks", blocks: overview } satisfies PageContent,
          staged: { kind: "blocks", blocks: overview } satisfies PageContent,
          sort: 0,
          publishedAt: new Date(),
        },
        {
          slug: "skills",
          title: "Skills & Certificates",
          kind: "skills" as PageKind,
          published: {
            kind: "skills",
            categories: skills.categories,
            skills: skills.skills,
          } satisfies PageContent,
          staged: {
            kind: "skills",
            categories: skills.categories,
            skills: skills.skills,
          } satisfies PageContent,
          sort: 1,
          publishedAt: new Date(),
        },
        {
          slug: "certificates",
          title: "Certificates",
          kind: "certificates" as PageKind,
          published: {
            kind: "certificates",
            certificates: certificates.certificates,
          } satisfies PageContent,
          staged: {
            kind: "certificates",
            certificates: certificates.certificates,
          } satisfies PageContent,
          sort: 3,
          publishedAt: new Date(),
        },
        {
          slug: "experience",
          title: "Experience",
          kind: "experience" as PageKind,
          published: {
            kind: "experience",
            entries: experience.entries,
          } satisfies PageContent,
          staged: {
            kind: "experience",
            entries: experience.entries,
          } satisfies PageContent,
          sort: 2,
          publishedAt: new Date(),
        },
      ])
      .onConflictDoNothing()
      .returning({ slug: pages.slug })
  ).length;

  const projectCount = (
    await db
      .insert(projects)
      .values(
        seedProjects.map((project, index) => ({
          slug: project.slug,
          published: project,
          staged: project,
          sort: index,
        })),
      )
      .onConflictDoNothing()
      .returning({ slug: projects.slug })
  ).length;

  const postCount = (
    await db
      .insert(posts)
      .values(
        seedPosts.map((post, index) => ({
          slug: post.slug,
          published: post,
          staged: post,
          sort: index,
        })),
      )
      .onConflictDoNothing()
      .returning({ slug: posts.slug })
  ).length;

  const settingsCount = (
    await db
      .insert(settings)
      .values({
        id: "site",
        published: siteIdentity,
        staged: siteIdentity,
      })
      .onConflictDoNothing()
      .returning({ id: settings.id })
  ).length;

  return {
    pages: pageCount,
    projects: projectCount,
    posts: postCount,
    settings: settingsCount,
  };
}

// --- CLI entry (npm run db:seed) -------------------------------------------
const entryPath = process.argv[1];
const invokedDirectly =
  entryPath !== undefined && fileURLToPath(import.meta.url) === resolve(entryPath);

if (invokedDirectly) {
  try {
    const counts = await seedContent();
    console.log(
      `Seeded → pages: ${counts.pages}, projects: ${counts.projects}, posts: ${counts.posts}, settings: ${counts.settings} (0 = already present).`,
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
