// Apply every .sql file in supabase/migrations (in filename order) to the
// DATABASE_URL database. Idempotent SQL, so re-running is safe.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});

let failures = 0;
for (const file of files) {
  const content = readFileSync(join(dir, file), "utf8");
  const statements = content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  // The file contains trigger/function bodies with semicolons — execute whole
  // file as one script instead of splitting (postgres.js supports multi-queries
  // only via .begin / simple query protocol). We use sql.unsafe with the file.
  try {
    await sql.unsafe(content);
    console.log(`applied: ${file}`);
  } catch (error) {
    failures += 1;
    console.error(`FAILED: ${file}\n${error.message}`);
  }
}

await sql.end();
if (failures > 0) process.exit(1);
