/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  normalizeCertificatesPage,
  normalizeExperiencePage,
  normalizePageContent,
  normalizeProject,
  normalizeSkillsPage,
  nextSort,
  removeCertificateReferences,
  removeProjectReferences,
  removeSkillReferences,
  replaceProjectSlug,
  stableId,
} from "@/lib/cms-normalize";
import type { Certificate, ExperienceEntry, Project, Skill } from "@/content/site";
import { planPageReferenceCleanup, planProjectDelete, planProjectRename } from "@/lib/cms-server";

describe("stableId", () => {
  it("is deterministic and slug-safe", () => {
    const a = stableId("skill", "LLMs & Agents / RAG");
    const b = stableId("skill", "LLMs & Agents / RAG");
    expect(a).toBe(b);
    expect(a).toMatch(/^skill-[a-z0-9-]+$/);
    expect(a).not.toMatch(/[&/ ]/);
  });

  it("produces different ids for different seeds", () => {
    expect(stableId("skill", "RAG")).not.toBe(stableId("skill", "Vector databases"));
  });
});

describe("nextSort", () => {
  it("returns max + 1", () => {
    expect(nextSort([{ sort: 0 }, { sort: 2 }, { sort: 1 }])).toBe(3);
    expect(nextSort([])).toBe(1);
    expect(nextSort([{ sort: 5 }])).toBe(6);
  });
});

describe("normalizeProject", () => {
  it("fills defaults and preserves unknown keys", () => {
    const out = normalizeProject({
      slug: "x",
      title: "X",
      legacyField: "keep-me",
    } as unknown as Project);
    expect(out.slug).toBe("x");
    expect(out.title).toBe("X");
    expect(out.dek).toBe("");
    expect(out.year).toBe(String(new Date().getFullYear()));
    expect(out.category).toBe("");
    expect(out.stack).toEqual([]);
    expect(out.blocks).toEqual([]);
    expect(out.status).toBeUndefined();
    expect(out.featured).toBeUndefined();
    expect((out as any).legacyField).toBe("keep-me");
  });

  it("normalizes known fields", () => {
    const out = normalizeProject({
      slug: "p",
      title: "P",
      status: "archived",
      featured: true,
      priority: 5,
      gallery: [{ src: "https://example.com/a.png" }],
    } as unknown as Project);
    expect(out.status).toBe("archived");
    expect(out.featured).toBe(true);
    expect(out.priority).toBe(5);
    expect(out.gallery).toHaveLength(1);
  });
});

describe("normalizeSkillsPage", () => {
  it("converts legacy groups to categories + skills", () => {
    const out = normalizeSkillsPage({
      kind: "skills",
      skills: [{ group: "LLMs", items: [{ name: "RAG", detail: "Hybrid search" }] }],
      certificates: [],
    } as any);
    expect(out.kind).toBe("skills");
    expect(out.categories).toHaveLength(1);
    expect(out.categories[0]!.name).toBe("LLMs");
    expect(out.categories[0]!.id).toBe("cat-llms");
    expect(out.skills).toHaveLength(1);
    expect(out.skills[0]!).toMatchObject({
      id: "skill-llms-rag",
      name: "RAG",
      categoryId: "cat-llms",
      detail: "Hybrid search",
      sort: 0,
      visible: true,
    });
  });

  it("passes through the new shape", () => {
    const out = normalizeSkillsPage({
      kind: "skills",
      categories: [{ id: "cat-a", name: "A", sort: 0 }],
      skills: [
        {
          id: "skill-a",
          name: "A",
          categoryId: "cat-a",
          level: "expert",
          years: 5,
          featured: true,
          visible: false,
          projectSlugs: ["p"],
          sort: 2,
        },
      ],
    } as any);
    expect(out.skills[0]!.featured).toBe(true);
    expect(out.skills[0]!.visible).toBe(false);
    expect(out.skills[0]!.projectSlugs).toEqual(["p"]);
    expect(out.skills[0]!.level).toBe("expert");
    expect(out.skills[0]!.years).toBe(5);
  });

  it("defaults missing skill fields", () => {
    const out = normalizeSkillsPage({
      kind: "skills",
      categories: [{ id: "cat-a", name: "A", sort: 0 }],
      skills: [{ id: "skill-a", name: "A", categoryId: "cat-a" }],
    } as any);
    expect(out.skills[0]!.visible).toBe(true);
    expect(out.skills[0]!.projectSlugs).toEqual([]);
    expect(out.skills[0]!.sort).toBe(0);
  });
});

describe("normalizeCertificatesPage", () => {
  it("converts legacy file blocks to certificates", () => {
    const out = normalizeCertificatesPage({
      kind: "skills",
      certificates: [{ type: "file", name: "Cloud AI", kind: "PDF", description: "Placeholder" }],
    } as any);
    expect(out.kind).toBe("certificates");
    expect(out.certificates).toHaveLength(1);
    expect(out.certificates[0]!.title).toBe("Cloud AI");
    expect(out.certificates[0]!.description).toBe("Placeholder");
    expect(out.certificates[0]!.sort).toBe(0);
    expect(out.certificates[0]!.visible).toBe(true);
    expect(out.certificates[0]!.id).toBe("cert-cloud-ai");
  });

  it("is idempotent", () => {
    const first = normalizeCertificatesPage({
      kind: "skills",
      certificates: [{ type: "file", name: "Cloud AI", description: "Placeholder" }],
    } as any);
    const second = normalizeCertificatesPage(first as any);
    expect(second.certificates).toEqual(first.certificates);
    expect(second.certificates[0]!.id).toBe(first.certificates[0]!.id);
  });

  it("passes through the new shape", () => {
    const out = normalizeCertificatesPage({
      kind: "certificates",
      certificates: [
        {
          id: "cert-a",
          title: "Cert A",
          issuer: "Issuer",
          issueDate: "2024-01-01",
          expiryDate: "2025-01-01",
          featured: true,
          visible: true,
          sort: 0,
        },
      ],
    } as any);
    expect(out.certificates[0]!.id).toBe("cert-a");
    expect(out.certificates[0]!.expiryDate).toBe("2025-01-01");
    expect(out.certificates[0]!.featured).toBe(true);
  });
});

describe("normalizeExperiencePage", () => {
  it("lifts text block into overview and list block into achievements", () => {
    const out = normalizeExperiencePage({
      kind: "experience",
      entries: [
        {
          role: "AI Engineer",
          org: "Co",
          period: "2024 — Present",
          blocks: [
            { type: "text", body: "Overview text." },
            { type: "list", items: ["Shipped X", "Built Y"] },
          ],
        },
      ],
    } as any);
    expect(out.entries[0]!.overview).toBe("Overview text.");
    expect(out.entries[0]!.achievements).toEqual(["Shipped X", "Built Y"]);
    expect(out.entries[0]!.current).toBe(true);
    expect(out.entries[0]!.period).toBe("2024 — Present");
  });

  it("keeps unmapped blocks in blocks", () => {
    const out = normalizeExperiencePage({
      kind: "experience",
      entries: [
        {
          role: "AI Engineer",
          org: "Co",
          period: "2024 — Present",
          blocks: [
            { type: "text", body: "Overview text." },
            { type: "image", src: "https://example.com/a.png", alt: "img" },
          ],
        },
      ],
    } as any);
    expect(out.entries[0]!.overview).toBe("Overview text.");
    expect(out.entries[0]!.blocks).toHaveLength(1);
    expect(out.entries[0]!.blocks?.[0]!.type).toBe("image");
  });

  it("does not lose anything when nothing lifts", () => {
    const out = normalizeExperiencePage({
      kind: "experience",
      entries: [
        {
          role: "AI Engineer",
          org: "Co",
          period: "2024 — Present",
          blocks: [{ type: "quote", text: "q" }],
        },
      ],
    } as any);
    expect(out.entries[0]!.overview).toBeUndefined();
    expect(out.entries[0]!.blocks).toHaveLength(1);
  });

  it("passes through the new shape", () => {
    const out = normalizeExperiencePage({
      kind: "experience",
      entries: [
        {
          id: "exp-a",
          role: "Role",
          org: "Org",
          current: true,
          tech: ["TS"],
          skillIds: ["skill-a"],
          visible: false,
          sort: 3,
        },
      ],
    } as any);
    expect(out.entries[0]!.current).toBe(true);
    expect(out.entries[0]!.tech).toEqual(["TS"]);
    expect(out.entries[0]!.skillIds).toEqual(["skill-a"]);
    expect(out.entries[0]!.visible).toBe(false);
    expect(out.entries[0]!.sort).toBe(3);
  });
});

describe("normalizePageContent", () => {
  it("dispatches by kind", () => {
    const skills = normalizePageContent("skills", {
      kind: "skills",
      categories: [{ id: "c", name: "C", sort: 0 }],
      skills: [],
    } as any);
    expect(skills.kind).toBe("skills");

    const certs = normalizePageContent("certificates", {
      kind: "certificates",
      certificates: [{ id: "x", title: "T", issuer: "I", visible: true, sort: 0 }],
    } as any);
    expect(certs.kind).toBe("certificates");

    const blocks = normalizePageContent("blocks", {
      kind: "blocks",
      blocks: [{ type: "text", body: "hi" }],
    });
    expect(blocks.kind).toBe("blocks");
    expect(blocks.blocks).toHaveLength(1);
  });
});

describe("reference integrity helpers", () => {
  describe("removeSkillReferences", () => {
    it("removes ids from skillIds arrays recursively", () => {
      const doc = {
        projectSlugs: ["p1"],
        skillIds: ["s1", "s2", "s3"],
        nested: { skillIds: ["s2", "s4"] },
      };
      const { doc: next, changed } = removeSkillReferences(doc, ["s2", "s99"]) as any;
      expect(changed).toBe(true);
      expect(next.skillIds).toEqual(["s1", "s3"]);
      expect(next.nested.skillIds).toEqual(["s4"]);
      // input not mutated
      expect(doc.skillIds).toEqual(["s1", "s2", "s3"]);
    });

    it("reports no change when nothing matches", () => {
      const { changed } = removeSkillReferences({ skillIds: ["s1"] }, ["s99"]);
      expect(changed).toBe(false);
    });
  });

  describe("removeProjectReferences", () => {
    it("removes slugs from projectSlugs arrays recursively", () => {
      const doc = { projectSlugs: ["p1", "p2"], nested: { projectSlugs: ["p2", "p3"] } };
      const { doc: next, changed } = removeProjectReferences(doc, ["p2"]) as any;
      expect(changed).toBe(true);
      expect(next.projectSlugs).toEqual(["p1"]);
      expect(next.nested.projectSlugs).toEqual(["p3"]);
    });
  });

  describe("removeCertificateReferences", () => {
    it("removes ids from certificateIds arrays", () => {
      const doc = { certificateIds: ["c1", "c2"] };
      const { doc: next, changed } = removeCertificateReferences(doc, ["c1"]) as any;
      expect(changed).toBe(true);
      expect(next.certificateIds).toEqual(["c2"]);
    });
  });

  describe("replaceProjectSlug", () => {
    it("rewrites slug occurrences in projectSlugs", () => {
      const doc = {
        projectSlugs: ["old", "other"],
        nested: { projectSlugs: ["old", "old"] },
      };
      const { doc: next, changed } = replaceProjectSlug(doc, "old", "new") as any;
      expect(changed).toBe(true);
      expect(next.projectSlugs).toEqual(["new", "other"]);
      expect(next.nested.projectSlugs).toEqual(["new", "new"]);
    });

    it("renames a top-level slug field", () => {
      const doc = { slug: "old", projectSlugs: ["other"] };
      const { doc: next, changed } = replaceProjectSlug(doc, "old", "new") as any;
      expect(changed).toBe(true);
      expect(next.slug).toBe("new");
    });

    it("reports no change when slugs are equal", () => {
      const { changed } = replaceProjectSlug({ slug: "x" }, "x", "x");
      expect(changed).toBe(false);
    });
  });
});

describe("server orchestration (pure)", () => {
  const pageRow = (slug: string, published: any, staged: any) =>
    ({
      slug,
      published,
      staged,
      sort: 0,
      updatedAt: new Date(),
    }) as any;

  it("planProjectRename changes project slug and all projectSlugs references", () => {
    const project = {
      slug: "old",
      title: "Old",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
    } as any;
    const pages = [
      pageRow(
        "skills",
        {
          kind: "skills",
          categories: [{ id: "c", name: "C", sort: 0 }],
          skills: [
            { id: "s1", name: "S", categoryId: "c", projectSlugs: ["old", "other"], sort: 0 },
          ],
        },
        {
          kind: "skills",
          categories: [{ id: "c", name: "C", sort: 0 }],
          skills: [
            { id: "s1", name: "S", categoryId: "c", projectSlugs: ["old", "other"], sort: 0 },
          ],
        },
      ),
      pageRow(
        "experience",
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", projectSlugs: ["old"], sort: 0 }],
        },
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", projectSlugs: ["old"], sort: 0 }],
        },
      ),
    ];
    const { project: nextProject, pages: nextPages } = planProjectRename({
      project,
      pages,
      oldSlug: "old",
      newSlug: "new",
    });
    expect(nextProject.slug).toBe("new");
    // projectSlugs references rewritten
    const skillsPub = nextPages[0]!.published as any;
    expect(skillsPub.skills[0].projectSlugs).toEqual(["new", "other"]);
    const expPub = nextPages[1]!.published as any;
    expect(expPub.entries[0].projectSlugs).toEqual(["new"]);
    // input not mutated
    expect(project.slug).toBe("old");
    expect(pages[0].published.skills[0].projectSlugs).toEqual(["old", "other"]);
  });

  it("planProjectDelete removes slug from skills and experience docs", () => {
    const pages = [
      pageRow(
        "skills",
        {
          kind: "skills",
          categories: [{ id: "c", name: "C", sort: 0 }],
          skills: [
            { id: "s1", name: "S", categoryId: "c", projectSlugs: ["target", "keep"], sort: 0 },
          ],
        },
        {
          kind: "skills",
          categories: [{ id: "c", name: "C", sort: 0 }],
          skills: [
            { id: "s1", name: "S", categoryId: "c", projectSlugs: ["target", "keep"], sort: 0 },
          ],
        },
      ),
      pageRow(
        "experience",
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", projectSlugs: ["target"], sort: 0 }],
        },
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", projectSlugs: ["target"], sort: 0 }],
        },
      ),
    ];
    const nextPages = planProjectDelete({ pages, slug: "target" });
    const skillsPub = nextPages[0]!.published as any;
    expect(skillsPub.skills[0].projectSlugs).toEqual(["keep"]);
    const expPub = nextPages[1]!.published as any;
    expect(expPub.entries[0].projectSlugs).toEqual([]);
    // input not mutated
    expect(pages[0].published.skills[0].projectSlugs).toEqual(["target", "keep"]);
  });

  it("planPageReferenceCleanup strips deleted skill ids from projects and experience pages", () => {
    const before = {
      kind: "skills",
      categories: [{ id: "c", name: "C", sort: 0 }],
      skills: [
        { id: "s-keep", name: "Keep", categoryId: "c", sort: 0 },
        { id: "s-gone", name: "Gone", categoryId: "c", sort: 1 },
      ],
    } as any;
    const after = {
      kind: "skills",
      categories: [{ id: "c", name: "C", sort: 0 }],
      skills: [{ id: "s-keep", name: "Keep", categoryId: "c", sort: 0 }],
    } as any;
    const projects = [
      {
        slug: "p1",
        title: "P1",
        dek: "d",
        year: "2024",
        category: "C",
        stack: [],
        blocks: [],
        skillIds: ["s-keep", "s-gone"],
      } as any,
    ];
    const pages = [
      pageRow(
        "experience",
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", skillIds: ["s-gone"], sort: 0 }],
        },
        {
          kind: "experience",
          entries: [{ id: "e1", role: "R", org: "O", skillIds: ["s-gone"], sort: 0 }],
        },
      ),
    ];
    const { projects: nextProjects, pages: nextPages } = planPageReferenceCleanup({
      kind: "skills",
      before,
      after,
      projects,
      pages,
    });
    expect(nextProjects[0]!.published.skillIds).toEqual(["s-keep"]);
    const expPub = nextPages[0]!.published as any;
    expect(expPub.entries[0].skillIds).toEqual([]);
    // input not mutated
    expect(projects[0].skillIds).toEqual(["s-keep", "s-gone"]);
  });
});
