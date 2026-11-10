// E2E DB verification helper: needle search in a staged/published documents row.
// Usage: node scripts/e2e-dbcheck.mjs '{"slug":"skills","column":"published","needles":["e2e Skill"],"expect":"present"}'
import postgres from "postgres";
import fs from "node:fs";

const args = JSON.parse(process.argv[2] ?? "{}");
const { slug = "skills", column = "published", needles = [], expect: expect_ = "present" } = args;

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error(JSON.stringify({ ok: false, error: "DATABASE_URL not set in .env" }));
  process.exit(2);
}
const url = line
  .slice("DATABASE_URL=".length)
  .trim()
  .replace(/^["']|["']$/g, "");

const sql = postgres(url, { max: 1, connect_timeout: 15, idle_timeout: 5 });

try {
  const rows = await sql`select published, staged from pages where slug = ${slug} limit 1`;
  if (!rows[0]) {
    console.log(JSON.stringify({ ok: false, error: `page ${slug} not found` }));
    process.exit(0);
  }
  const row = rows[0];
  const doc = typeof row.published === "string" ? JSON.parse(row.published) : row.published;
  const raw = column === "staged" ? null : doc;
  const json = JSON.stringify(column === "staged" ? row.staged : doc);
  const found = needles.filter((n) => json.includes(n));
  const result =
    expect_ === "present" ? found.length === needles.length : found.length === 0;
  console.log(
    JSON.stringify({ ok: result, found, column, expect: expect_, bytes: json.length }),
  );
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
} finally {
  await sql.end({ timeout: 5 });
}
