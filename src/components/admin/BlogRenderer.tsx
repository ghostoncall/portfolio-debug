// Shared blog renderer.
//
// Renders Koenig-compatible content (HTML body or legacy Blocks) using the
// actual website design system. Used by:
//   - Admin preview (/onlyme/preview/$slug)
//   - Editor live preview (split-screen mode)
//   - Public blog detail page (/blog/$slug)
//
// This ensures the preview matches the published output exactly.
//
import type { CSSProperties } from "react";
import { Blocks } from "@/components/blocks";
import { Media } from "@/components/media";
import { blogThemeVars, type BlogSettings } from "@/lib/blog-settings";
import type { Post } from "@/content/site";

const FALLBACK_SETTINGS: BlogSettings = {
  heading: "Writing & Notes",
  description: "Essays and notes on applied AI, LLMs, retrieval and engineering.",
  layout: "list",
  postsPerPage: 10,
  featured: { enabled: false, position: "top" },
  card: {
    showImage: false,
    imageRatio: "16/9",
    showExcerpt: true,
    excerptLength: 180,
    showAuthor: true,
    showDate: true,
    showTags: true,
    style: "divided",
  },
  pagination: { enabled: true },
  empty: {
    heading: "Nothing published yet",
    body: "New writing will appear here as soon as it is published.",
    image: "",
  },
  typography: {
    headingFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont: '"Libre Baskerville", Georgia, serif',
    baseSize: 17,
    headingScale: 1,
    lineHeight: 1.75,
    contentWidth: 48,
    imageSpacing: 2,
    paragraphSpacing: 1.25,
    background: "#fdfdfc",
    text: "#1a1a1a",
    link: "#4a6f8a",
    accent: "#1a1a1a",
  },
};

type BlogRendererProps = {
  post: Post;
  themeVars?: CSSProperties;
  className?: string;
};

export function BlogRenderer({ post, themeVars, className }: BlogRendererProps) {
  const vars = themeVars ?? blogThemeVars(FALLBACK_SETTINGS);

  return (
    <div style={vars} className={`blog-theme ${className ?? ""}`}>
      {post.dek && <p className="font-serif text-xl italic text-muted-foreground">{post.dek}</p>}
      <p className="label-caps mt-6 border-y border-border py-3 text-muted-foreground">
        By {post.author || "Admin"} ·{" "}
        <time dateTime={post.date}>{new Date(post.date).toLocaleDateString()}</time>
        {post.readTime ? ` · ${post.readTime}` : ""}
        {post.tags.length ? ` · ${post.tags.join(", ")}` : ""}
      </p>
      {post.cover?.src && <Media items={[post.cover]} />}
      {post.body?.html ? (
        <div
          className="kg-content prose-editorial"
          dangerouslySetInnerHTML={{ __html: post.body.html }}
        />
      ) : (
        <Blocks blocks={post.blocks} />
      )}
    </div>
  );
}
