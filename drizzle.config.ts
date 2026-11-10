// drizzle-kit configuration.
//   npm run db:generate — diff schema → SQL files in ./drizzle (offline)
//   npm run db:migrate  — apply generated SQL (needs DATABASE_URL in .env)
//   npm run db:push     — quick-and-dirty alternative: push schema directly
//   npm run db:seed     — fill empty tables from src/content/site.ts

import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
