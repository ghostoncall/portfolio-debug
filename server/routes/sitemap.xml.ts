// Sitemap for the public blog.
// Public: no auth required. Only published, live (not scheduled), non-private posts.
import { defineEventHandler } from "h3";
import { getDb } from "../../src/db/client";
import { posts } from "../../src/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";

const SITE = "https://example.com";

export default defineEventHandler(async () => {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(
      and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
    )
    .orderBy(posts.updatedAt);

  const pages = [
    { url: `${SITE}/blog`, updated: new Date().toISOString() },
    ...rows.map((r) => ({
      url: `${SITE}/blog/${r.slug}`,
      updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
    })),
  ];

  const urls = pages
    .map(
      (p) => `<url>
  <loc>${escapeXml(p.url)}</loc>
  <lastmod>${p.updated}</lastmod>
</url>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
});

function escapeXml(value: string | undefined | null): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
