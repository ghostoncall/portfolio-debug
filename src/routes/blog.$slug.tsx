/* eslint-disable @typescript-eslint/no-explicit-any */
// Public blog post page.
import type { CSSProperties } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { BlogRenderer } from "@/components/admin/BlogRenderer";
import { getBlogSettings, getPublishedPost, getSiteIdentity } from "@/lib/server-fns";
import { blogThemeVars } from "@/lib/blog-settings";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const [post, site, settings] = await Promise.all([
      (getPublishedPost as any)({ data: { slug: params.slug } }),
      (getSiteIdentity as any)(),
      (getBlogSettings as any)(),
    ]);
    if (!post) throw notFound();
    return { post, site, settings };
  },
  head: ({ loaderData }) => {
    const { post, site } = loaderData || {};
    if (!post) {
      return { meta: [{ title: "Post not found" }, { name: "robots", content: "noindex" }] };
    }
    const title = post.seo?.title || post.title;
    const description = post.seo?.description || post.dek || "";
    const image = post.seo?.socialImage || post.cover?.src || "";
    const canonical = post.seo?.canonical || "";
    const unlisted = post.visibility === "unlisted";

    return {
      meta: [
        { title: `${title} — ${site?.name ?? "Portfolio"}` },
        { name: "description", content: description },
        ...(unlisted ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: post.date },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(canonical ? [{ property: "og:url", content: canonical }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
    };
  },
  notFoundComponent: () => {
    const { site } = Route.useLoaderData() as { site: any };
    return (
      <PageShell crumbs={["Blog"]} title="Post not found" site={site}>
        <Link to="/blog" className="text-link hover:underline">
          Back to the blog
        </Link>
      </PageShell>
    );
  },
  component: PostPage,
});

function PostPage() {
  const { post, site, settings } = Route.useLoaderData();
  const vars = blogThemeVars(settings) as CSSProperties;

  return (
    <div style={vars} className="blog-theme">
      <PageShell crumbs={["Blog", post.title]} title={post.title} site={site}>
        <BlogRenderer post={post} themeVars={vars} />
        <Link
          to="/blog"
          search={{ page: 1 }}
          className="label-caps mt-12 inline-block text-link hover:underline"
        >
          ← All posts
        </Link>
      </PageShell>
    </div>
  );
}
