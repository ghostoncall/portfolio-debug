/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { validatePageDoc, validateProjectDoc, assertValidContent } from "@/lib/cms-validation";
import type { PageKind } from "@/content/site";

describe("validateProjectDoc", () => {
  it("fails when title is missing", () => {
    const r = validateProjectDoc({
      slug: "x",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["title"]).toBeDefined();
  });

  it("fails when slug is not slug-safe", () => {
    const r = validateProjectDoc({
      slug: "Bad Slug",
      title: "T",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["slug"]).toBeDefined();
  });

  it("fails when status is not a valid enum", () => {
    const r = validateProjectDoc({
      slug: "x",
      title: "T",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
      status: "done" as any,
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["status"]).toBeDefined();
  });

  it("fails when a link href is not a URL", () => {
    const r = validateProjectDoc({
      slug: "x",
      title: "T",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
      links: [{ id: "l1", label: "Site", href: "not a url", kind: "live" }],
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["links.0.href"]).toBeDefined();
  });

  it("passes for relative and absolute hrefs", () => {
    const r = validateProjectDoc({
      slug: "x",
      title: "T",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
      links: [
        { id: "l1", label: "Site", href: "/relative/path", kind: "live" },
        { id: "l2", label: "GitHub", href: "https://example.com", kind: "github" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("accepts extra legacy keys via passthrough", () => {
    const r = validateProjectDoc({
      slug: "x",
      title: "T",
      dek: "d",
      year: "2024",
      category: "C",
      stack: [],
      blocks: [],
      legacyKey: "keep",
    });
    expect(r.ok).toBe(true);
  });
});

describe("validatePageDoc", () => {
  it("fails when a skill references a missing categoryId", () => {
    const r = validatePageDoc("skills", {
      kind: "skills",
      categories: [{ id: "cat-a", name: "A", sort: 0 }],
      skills: [{ id: "s1", name: "S", categoryId: "cat-missing", sort: 0 }],
    } as any);
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["skills.0.categoryId"]).toBeDefined();
  });

  it("fails when certificate expiry precedes issue", () => {
    const r = validatePageDoc("certificates", {
      kind: "certificates",
      certificates: [
        {
          id: "c1",
          title: "T",
          issuer: "I",
          issueDate: "2025-01-01",
          expiryDate: "2024-01-01",
          visible: true,
          sort: 0,
        },
      ],
    } as any);
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["certificates.0.expiryDate"]).toBeDefined();
  });

  it("fails when current role has an end date", () => {
    const r = validatePageDoc("experience", {
      kind: "experience",
      entries: [
        {
          id: "e1",
          role: "R",
          org: "O",
          current: true,
          endDate: "2025-01-01",
          visible: true,
          sort: 0,
        },
      ],
    } as any);
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["entries.0.endDate"]).toBeDefined();
  });

  it("fails when end date precedes start date", () => {
    const r = validatePageDoc("experience", {
      kind: "experience",
      entries: [
        {
          id: "e1",
          role: "R",
          org: "O",
          startDate: "2025-01-01",
          endDate: "2024-01-01",
          visible: true,
          sort: 0,
        },
      ],
    } as any);
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.errors["entries.0.endDate"]).toBeDefined();
  });

  it("passes for blocks pages", () => {
    const r = validatePageDoc("blocks", { kind: "blocks", blocks: [{ type: "text", body: "hi" }] });
    expect(r.ok).toBe(true);
  });
});

describe("assertValidContent", () => {
  it("throws 400 for invalid project content", () => {
    let caught: any = null;
    try {
      assertValidContent("projects", {
        slug: "bad slug",
        title: "T",
        dek: "d",
        year: "2024",
        category: "C",
        stack: [],
        blocks: [],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.statusCode).toBe(400);
  });

  it("does not throw for posts", () => {
    let threw = false;
    try {
      assertValidContent("posts", { anything: "goes" });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it("does not throw for settings", () => {
    let threw = false;
    try {
      assertValidContent("settings", { anything: "goes" });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
