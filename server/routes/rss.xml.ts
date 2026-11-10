// RSS feed for published blog posts.
// Public: no auth required. Only published, live (not scheduled), non-private posts.
import { defineEventHandler } from "h3";
import { getDb } from "../../src/db/client";
import { posts } from "../../src/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";

export default defineEventHandler(async () => {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ published: posts.published, slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(
      and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
    )
    .orderBy(posts.updatedAt);

  const items = rows
    .map((r) => {
      const p = r.published;
      const url = `https://example.com/blog/${p.slug}`;
      const pub = new Date(r.updatedAt ?? Date.now()).toISOString();
      const desc = p.dek || "";
      return `<item>
        <title>${escapeXml(p.title)}</title>
        <link>${url}</link>
        <guid isPermaLink="false">${url}</guid>
        <pubDate>${pub}</pubDate>
        <description>${escapeXml(desc)}</description>
      </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Writing &amp; Notes</title>
    <link>https://example.com/blog</link>
    <description>Essays and notes on applied AI, LLMs, retrieval and engineering.</description>
    <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
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
