/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin preview of a blog post. Renders the staged content using the same
// styling as the public blog so the author can review before publishing.
// Protected by the /onlyme admin route guard — never accessible anonymously.
import type { CSSProperties } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { BlogRenderer } from "@/components/admin/BlogRenderer";
import { getPostPreview, getSiteIdentity } from "@/lib/server-fns";
import { blogThemeVars, mergeBlogSettings } from "@/lib/blog-settings";

export const Route = createFileRoute("/onlyme/preview/$slug")({
  loader: async ({ params }) => {
    const [data, site] = await Promise.all([
      (getPostPreview as any)({ data: { slug: params.slug } }),
      (getSiteIdentity as any)(),
    ]);
    if (!data) throw notFound();
    return {
      post: data.staged,
      live: data.published,
      isPublic: data.isPublic,
      publishedAt: data.publishedAt,
      site,
    };
  },
  component: PreviewPage,
});

function PreviewPage() {
  const { post, live, isPublic, publishedAt, site } = Route.useLoaderData();
  if (!post) throw notFound();

  const isPublished = Boolean(isPublic);
  const scheduled = publishedAt && new Date(publishedAt).getTime() > Date.now();

  const vars = blogThemeVars(mergeBlogSettings({})) as CSSProperties;

  return (
    <div style={vars} className="blog-theme">
      <PageShell crumbs={["Blog", "Preview"]} title={`Preview: ${post.title}`} site={site}>
        <div className="border-l border-amber-500 pl-4 my-6">
          <p className="text-xs text-amber-700 font-sans uppercase tracking-wide mb-1">
            Preview — not publicly visible
          </p>
          <p className="text-sm text-muted-foreground">
            {scheduled
              ? `Scheduled to publish on ${new Date(publishedAt!).toLocaleString()}.`
              : isPublished
                ? "This post is published and publicly visible."
                : "This post is a draft and not yet published."}
          </p>
        </div>

        <BlogRenderer post={post} themeVars={vars} />

        <div className="mt-10 flex gap-3">
          <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            target="_blank"
            disabled={!isPublished}
            className={`inline-flex items-center gap-2 border rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50 ${
              isPublished
                ? "text-link hover:underline border-border"
                : "text-muted-foreground border-border bg-muted"
            }`}
          >
            {isPublished ? "View live post ↗" : "Publish to view live"}
          </Link>
          <Link
            to="/onlyme/blogs/$slug"
            params={{ slug: post.slug }}
            className="border border-input bg-background px-5 py-2 text-sm text-foreground hover:bg-accent"
          >
            ← Back to editor
          </Link>
        </div>
      </PageShell>
    </div>
  );
}
