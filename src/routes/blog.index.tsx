/* eslint-disable @typescript-eslint/no-explicit-any */
// Public blog index.
import type { CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getBlogSettings, getPublishedPosts, getSiteIdentity } from "@/lib/server-fns";
import { blogThemeVars } from "@/lib/blog-settings";
import type { BlogSettings } from "@/lib/blog-settings";
import type { Post } from "@/content/site";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const [posts, site, settings] = await Promise.all([
      (getPublishedPosts as any)(),
      (getSiteIdentity as any)(),
      (getBlogSettings as any)(),
    ]);
    return { posts: posts as Post[], site, settings: settings as BlogSettings };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    const settings = loaderData?.settings;
    const description =
      settings?.description ||
      `Essays and notes on applied AI, LLMs, retrieval and engineering by ${site?.name ?? "AI Engineer"}.`;
    return {
      meta: [
        { title: `${settings?.heading ?? "Blog"} — ${site?.name ?? "Portfolio"}` },
        { name: "description", content: description },
        {
          property: "og:title",
          content: `${settings?.heading ?? "Writing"} — ${site?.name ?? "Portfolio"}`,
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: BlogIndex,
});

function BlogIndex() {
  const { posts, settings, site } = Route.useLoaderData();
  const page = Math.max(1, Number((Route.useSearch() as any).page ?? 1));
  const vars = blogThemeVars(settings) as CSSProperties;

  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  const featuredPost =
    settings.featured.enabled && settings.featured.position === "hero"
      ? sorted.find((post) => post.featured)
      : undefined;
  const listable = featuredPost ? sorted.filter((post) => post.slug !== featuredPost.slug) : sorted;

  const perPage = Math.max(1, settings.postsPerPage || 10);
  const totalPages = Math.max(1, Math.ceil(listable.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = settings.pagination.enabled
    ? listable.slice((currentPage - 1) * perPage, currentPage * perPage)
    : listable;

  return (
    <div style={vars} className="blog-theme">
      <PageShell crumbs={["Blog"]} title={settings.heading} site={site}>
        {settings.description && (
          <p className="max-w-2xl font-serif text-lg text-muted-foreground">
            {settings.description}
          </p>
        )}

        {sorted.length === 0 ? (
          <EmptyState settings={settings} />
        ) : (
          <>
            {featuredPost && <FeaturedCard post={featuredPost} settings={settings} />}

            {settings.layout === "grid" ? (
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {pagePosts.map((post) => (
                  <PostCard key={post.slug} post={post} settings={settings} variant="grid" />
                ))}
              </div>
            ) : (
              <ul className="mt-8 border-t border-border">
                {pagePosts.map((post) => (
                  <li key={post.slug} className="border-b border-border">
                    <PostCard post={post} settings={settings} variant="list" />
                  </li>
                ))}
              </ul>
            )}

            {settings.pagination.enabled && totalPages > 1 && (
              <nav
                className="mt-10 flex items-center justify-between border-t border-border pt-5 text-sm"
                aria-label="Pagination"
              >
                <PageLink page={currentPage - 1} disabled={currentPage <= 1}>
                  ← Newer
                </PageLink>
                <span className="label-caps text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <PageLink page={currentPage + 1} disabled={currentPage >= totalPages}>
                  Older →
                </PageLink>
              </nav>
            )}
          </>
        )}
      </PageShell>
    </div>
  );
}

function EmptyState({ settings }: { settings: BlogSettings }) {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 border border-dashed border-border py-20 text-center">
      {settings.empty.image && (
        <img
          src={settings.empty.image}
          alt=""
          className="max-h-40 w-auto object-contain"
          loading="lazy"
        />
      )}
      <h2 className="font-display text-3xl text-foreground">{settings.empty.heading}</h2>
      <p className="max-w-md font-serif text-muted-foreground">{settings.empty.body}</p>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-muted-foreground/50">{children}</span>;
  }
  return (
    <Link to="/blog" search={{ page } as any} className="text-link hover:underline">
      {children}
    </Link>
  );
}

function CardImage({ post, settings }: { post: Post; settings: BlogSettings }) {
  if (!settings.card.showImage || !post.cover?.src) return null;
  return (
    <div
      className="overflow-hidden border border-border bg-muted"
      style={{ aspectRatio: settings.card.imageRatio }}
    >
      <img
        src={post.cover.src}
        alt={post.cover.alt ?? ""}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

function CardMeta({ post, settings }: { post: Post; settings: BlogSettings }) {
  const parts: string[] = [];
  if (settings.card.showDate) parts.push(formatDate(post.date));
  if (settings.card.showAuthor && post.author) parts.push(post.author);
  if (settings.card.showTags && post.tags.length) parts.push(post.tags.join(" · "));
  if (!parts.length) return null;
  return <span className="label-caps text-muted-foreground">{parts.join(" · ")}</span>;
}

function excerpt(post: Post, settings: BlogSettings): string | null {
  if (!settings.card.showExcerpt || !post.dek) return null;
  const limit = Math.max(0, settings.card.excerptLength || 180);
  if (post.dek.length <= limit) return post.dek;
  return `${post.dek.slice(0, limit).trimEnd()}…`;
}

function PostCard({
  post,
  settings,
  variant,
}: {
  post: Post;
  settings: BlogSettings;
  variant: "list" | "grid";
}) {
  const border =
    settings.card.style === "bordered"
      ? "border border-border p-4"
      : settings.card.style === "divided"
        ? ""
        : "";
  const body = (
    <>
      <CardImage post={post} settings={settings} />
      <CardMeta post={post} settings={settings} />
      <span className="mt-1 block font-display text-2xl leading-tight text-foreground group-hover:underline">
        {post.title}
      </span>
      {excerpt(post, settings) && (
        <span className="mt-2 block font-serif text-muted-foreground">
          {excerpt(post, settings)}
        </span>
      )}
      {post.readTime && <span className="mt-3 block text-sm text-link">{post.readTime}</span>}
    </>
  );

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className={`group block ${variant === "list" ? "py-6" : ""} ${border} ${
        variant === "list" ? "grid gap-2 md:grid-cols-[9rem_1fr]" : "flex h-full flex-col gap-3"
      }`}
    >
      {variant === "list" ? (
        <>
          <span className="label-caps pt-1 text-muted-foreground">{formatDate(post.date)}</span>
          <span className="min-w-0">{body}</span>
        </>
      ) : (
        body
      )}
    </Link>
  );
}

function FeaturedCard({ post, settings }: { post: Post; settings: BlogSettings }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group mt-10 block border-y border-border py-8"
    >
      <span className="label-caps text-muted-foreground">Featured</span>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_18rem] md:items-center">
        <div>
          <span className="block font-display text-4xl leading-tight text-foreground group-hover:underline">
            {post.title}
          </span>
          {excerpt(post, settings) && (
            <span className="mt-3 block font-serif text-lg text-muted-foreground">
              {excerpt(post, settings)}
            </span>
          )}
          <span className="mt-4 block">
            <CardMeta post={post} settings={settings} />
          </span>
        </div>
        {settings.card.showImage && post.cover?.src && (
          <div
            className="overflow-hidden border border-border bg-muted"
            style={{ aspectRatio: settings.card.imageRatio }}
          >
            <img
              src={post.cover.src}
              alt={post.cover.alt ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
