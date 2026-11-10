// One-time CMS content migration.
//
// Converts legacy documents to the current CMS shapes, idempotently:
//   - pages/skills: legacy {group, items} -> categories + skills
//   - pages/skills: legacy certificate file-blocks -> new `certificates` page row
//   - pages/experience: lift text/list blocks into overview/achievements, add ids
//   - projects: fill in new optional fields (status, featured, gallery, links, ...)
//
// Writes a full JSON backup before any change. Safe to re-run: second run
// reports zero changes and never duplicates the `certificates` row.
//
// Run:  node scripts/migrate-cms-content.mjs

import dotenv from "dotenv";
dotenv.config();

import postgres from "postgres";
import { writeFileSync, mkdirSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

const sql = postgres(url, { prepare: false, ssl: "require", max: 5 });

function parseJsonb(val) {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `/tmp/opencode/cms-backup-${stamp}.json`;

  // --- Full JSON backup before any write ---------------------------------
  const allPages = await sql`select * from pages`;
  const allProjects = await sql`select * from projects`;
  const allPosts = await sql`select * from posts`;
  const allSettings = await sql`select * from settings`;
  const backup = {
    exportedAt: new Date().toISOString(),
    pages: allPages,
    projects: allProjects,
    posts: allPosts,
    settings: allSettings,
  };
  mkdirSync("/tmp/opencode", { recursive: true });
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log("Backup written to", backupPath);

  let changed = 0;

  // Helper: update a jsonb column on a row by slug. `table`/`copy` are
  // whitelisted literal identifiers (inlined in the SQL); value/slug are parameters.
  async function setJsonb(table, copy, slug, value) {
    if (table === "pages" && copy === "published") {
      await sql`update pages set published = ${sql.json(value)}, updated_at = now() where slug = ${slug}`;
    } else if (table === "pages" && copy === "staged") {
      await sql`update pages set staged = ${sql.json(value)}, updated_at = now() where slug = ${slug}`;
    } else if (table === "projects" && copy === "published") {
      await sql`update projects set published = ${sql.json(value)}, updated_at = now() where slug = ${slug}`;
    } else if (table === "projects" && copy === "staged") {
      await sql`update projects set staged = ${sql.json(value)}, updated_at = now() where slug = ${slug}`;
    } else {
      throw new Error(`Unsupported table/copy: ${table}.${copy}`);
    }
  }

  // --- 1. pages/skills: legacy groups -> categories + skills --------------
  const skillsRows = await sql`select * from pages where slug='skills'`;
  if (skillsRows[0]) {
    const row = skillsRows[0];
    const pub = parseJsonb(row.published);
    const stg = parseJsonb(row.staged);
    if (!Array.isArray(pub.categories)) {
      const categories = [];
      const skills = [];
      let catSort = 0;
      for (const g of pub.skills ?? []) {
        const catId = `cat-${slugify(g.group)}`;
        categories.push({ id: catId, name: g.group, sort: catSort++, visible: true });
        let skillSort = 0;
        for (const item of g.items ?? []) {
          skills.push({
            id: `skill-${catId}-${slugify(item.name)}`,
            name: item.name,
            categoryId: catId,
            detail: item.detail ?? undefined,
            visible: true,
            sort: skillSort++,
          });
        }
      }
      const nextPub = { ...pub, kind: "skills", categories, skills };
      delete nextPub.certificates;
      const nextStg = { ...stg, kind: "skills", categories, skills };
      delete nextStg.certificates;
      if (!jsonEqual(pub, nextPub) || !jsonEqual(stg, nextStg)) {
        await setJsonb("pages", "published", "skills", nextPub);
        await setJsonb("pages", "staged", "skills", nextStg);
        changed += 1;
      }
    }
  }

  // --- 2. Create pages/certificates row from legacy certificate blocks ---
  const certsRows = await sql`select * from pages where slug='certificates'`;
  const sourceSkills = skillsRows[0];
  const legacyCerts = sourceSkills && Array.isArray(parseJsonb(sourceSkills.published).certificates)
    ? parseJsonb(sourceSkills.published).certificates
    : [];
  const certData = legacyCerts.map((b, i) => ({
    id: `cert-${slugify(b.name)}` || `cert-${i}`,
    title: b.name,
    issuer: b.issuer ?? "",
    description: b.description ?? undefined,
    visible: true,
    sort: i,
  }));
  if (!certsRows[0]) {
    const doc = { kind: "certificates", certificates: certData };
    await sql`insert into pages (slug, title, kind, published, staged, sort, updated_at)
      values ('certificates', 'Certificates', 'certificates', ${sql.json(doc)}, ${sql.json(doc)}, 3, now())`;
    changed += 1;
  }

  // --- 3. pages/experience: lift blocks, add ids -------------------------
  const expRows = await sql`select * from pages where slug='experience'`;
  if (expRows[0]) {
    const row = expRows[0];
    for (const copy of ["published", "staged"]) {
      const doc = parseJsonb(row[copy]);
      if (doc.kind !== "experience" || !Array.isArray(doc.entries)) continue;
      let rowChanged = false;
      const nextEntries = doc.entries.map((e, i) => {
        const next = { ...e };
        if (!next.id) {
          next.id = `exp-${slugify(e.role)}-${slugify(e.org)}-${i}`;
          rowChanged = true;
        }
        if (e.blocks && !e.overview && !e.achievements) {
          const textBlocks = e.blocks.filter((b) => b.type === "text");
          const listBlocks = e.blocks.filter((b) => b.type === "list");
          if (textBlocks.length === 1) next.overview = textBlocks[0].body;
          if (listBlocks.length === 1) next.achievements = listBlocks[0].items;
          next.current = (e.period ?? "").toLowerCase().includes("present");
        }
        if (next.visible === undefined) {
          next.visible = true;
          rowChanged = true;
        }
        if (next.sort === undefined) {
          next.sort = i;
          rowChanged = true;
        }
        return next;
      });
      if (rowChanged) {
        await setJsonb("pages", copy, "experience", { ...doc, entries: nextEntries });
        changed += 1;
      }
    }
  }

  // --- 4. projects: fill new optional fields -----------------------------
  const projRows = await sql`select * from projects`;
  const nowStr = new Date().toISOString().slice(0, 10);
  for (const r of projRows) {
    for (const copy of ["published", "staged"]) {
      const doc = parseJsonb(r[copy]);
      const next = { ...doc };
      let projChanged = false;
      const setIfMissing = (key, value) => {
        if (next[key] === undefined) {
          next[key] = value;
          projChanged = true;
        }
      };
      setIfMissing("status", "completed");
      setIfMissing("featured", false);
      setIfMissing("gallery", []);
      setIfMissing("links", []);
      setIfMissing("skillIds", []);
      setIfMissing("createdAt", nowStr);
      setIfMissing("updatedAt", nowStr);
      if (projChanged) {
        await setJsonb("projects", copy, r.slug, next);
        changed += 1;
      }
    }
  }

  console.log(`Migration complete — changed rows: ${changed}`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
