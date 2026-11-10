/* eslint-disable @typescript-eslint/no-explicit-any */
// Pure cross-document reference orchestration for the CMS.
//
// These functions accept plain data and return plain data — no server-fn
// wrappers, no DB access. They are called by server functions in
// src/lib/server-fns.ts, which own transactions and authorization.

import type {
  PageContent,
  PageKind,
  PageRow,
  Project,
  ProjectRow,
  Skill,
  SkillsPageContent,
} from "@/db/schema";
import {
  normalizePageContent,
  removeProjectReferences,
  removeSkillReferences,
  replaceProjectSlug,
} from "@/lib/cms-normalize";

/** Plan a project slug rename: rewrite the project slug and every
 * `projectSlugs` reference to it across all page documents. */
export function planProjectRename(input: {
  project: Project;
  pages: PageRow[];
  oldSlug: string;
  newSlug: string;
}): {
  project: Project;
  pages: Array<{ slug: string; published: PageContent; staged: PageContent }>;
} {
  const { project, pages, oldSlug, newSlug } = input;
  const nextProject = replaceProjectSlug(project, oldSlug, newSlug).doc as Project;
  (nextProject as any).slug = newSlug;

  const nextPages = pages.map((row) => {
    const published = normalizePageContent(row.published.kind, row.published);
    const staged = normalizePageContent(row.staged.kind, row.staged);
    let pubChanged = false;
    let stgChanged = false;
    const pubResult = replaceProjectSlug(published, oldSlug, newSlug);
    if (pubResult.changed) {
      pubChanged = true;
      // replaceProjectSlug already renamed top-level slug; clear it on pages
    }
    const stgResult = replaceProjectSlug(staged, oldSlug, newSlug);
    if (stgResult.changed) stgChanged = true;
    if (pubChanged || stgChanged) {
      return {
        slug: row.slug,
        published: pubResult.doc as PageContent,
        staged: stgResult.doc as PageContent,
      };
    }
    return { slug: row.slug, published, staged };
  });

  return { project: nextProject, pages: nextPages };
}

/** Plan a project deletion: remove the slug from every `projectSlugs`
 * reference across all page documents (skills and experience). */
export function planProjectDelete(input: {
  pages: PageRow[];
  slug: string;
}): Array<{ slug: string; published: PageContent; staged: PageContent }> {
  const { pages, slug } = input;
  return pages.map((row) => {
    const published = normalizePageContent(row.published.kind, row.published);
    const staged = normalizePageContent(row.staged.kind, row.staged);
    const pubResult = removeProjectReferences(published, [slug]);
    const stgResult = removeProjectReferences(staged, [slug]);
    return {
      slug: row.slug,
      published: (pubResult.changed ? pubResult.doc : published) as PageContent,
      staged: (stgResult.changed ? stgResult.doc : staged) as PageContent,
    };
  });
}

/** Plan reference cleanup when a skills or certificates page is saved.
 *
 * Computes which skill/certificate ids were removed and strips them from
 * referencing projects and pages (experience entries, certificate skillIds).
 */
export function planPageReferenceCleanup(input: {
  kind: "skills" | "certificates";
  before: PageContent;
  after: PageContent;
  projects: Project[];
  pages: PageRow[];
}): {
  projects: Array<{ slug: string; published: Project; staged: Project }>;
  pages: Array<{ slug: string; published: PageContent; staged: PageContent }>;
} {
  const { kind, before, after, projects, pages } = input;
  const removedSkillIds: string[] = [];

  if (kind === "skills") {
    const beforeSkills = (before as SkillsPageContent).skills ?? [];
    const afterSkills = (after as SkillsPageContent).skills ?? [];
    const afterIds = new Set(afterSkills.map((s) => s.id));
    for (const s of beforeSkills) if (!afterIds.has(s.id)) removedSkillIds.push(s.id);
  }

  // Clean projects: each project references skills via skillIds.
  const updatedProjects = projects.map((project) => {
    const pubResult = removeSkillReferences(project, removedSkillIds);
    const stgResult = removeSkillReferences(project, removedSkillIds);
    return {
      slug: project.slug,
      published: (pubResult.changed ? pubResult.doc : project) as Project,
      staged: (stgResult.changed ? stgResult.doc : project) as Project,
    };
  });

  // Clean pages: experience entries reference skills via skillIds;
  // skills reference projects via projectSlugs (untouched here).
  const updatedPages = pages.map((row) => {
    const published = normalizePageContent(row.published.kind, row.published);
    const staged = normalizePageContent(row.staged.kind, row.staged);
    const pubResult = removeSkillReferences(published, removedSkillIds);
    const stgResult = removeSkillReferences(staged, removedSkillIds);
    return {
      slug: row.slug,
      published: (pubResult.changed ? pubResult.doc : published) as PageContent,
      staged: (stgResult.changed ? stgResult.doc : staged) as PageContent,
    };
  });

  return { projects: updatedProjects, pages: updatedPages };
}
