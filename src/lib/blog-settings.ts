// Blog appearance + typography settings.
//
// Stored as one JSONB document in `blog_settings` (id = "blog") so new
// options can ship without a database migration. Everything here has a
// default that reproduces the existing editorial look; the admin panel
// only stores overrides, and `mergeBlogSettings` fills the rest in.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type BlogCardStyle = "divided" | "bordered" | "plain";
export type BlogLayout = "list" | "grid";

export type BlogSettings = {
  heading: string;
  description: string;
  layout: BlogLayout;
  postsPerPage: number;
  featured: {
    enabled: boolean;
    position: "top" | "hero";
  };
  card: {
    showImage: boolean;
    imageRatio: string;
    showExcerpt: boolean;
    excerptLength: number;
    showAuthor: boolean;
    showDate: boolean;
    showTags: boolean;
    style: BlogCardStyle;
  };
  pagination: {
    enabled: boolean;
  };
  empty: {
    heading: string;
    body: string;
    image: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSize: number;
    headingScale: number;
    lineHeight: number;
    contentWidth: number;
    imageSpacing: number;
    paragraphSpacing: number;
    background: string;
    text: string;
    link: string;
    accent: string;
  };
};

export const FONT_OPTIONS = [
  { label: "Libre Baskerville (serif)", value: '"Libre Baskerville", Georgia, serif' },
  { label: "Cormorant Garamond (display serif)", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Georgia (system serif)", value: "Georgia, serif" },
  { label: "Times New Roman (system serif)", value: '"Times New Roman", Times, serif' },
  { label: "Lato (sans)", value: '"Lato", system-ui, sans-serif' },
  { label: "Inter (sans)", value: "Inter, system-ui, sans-serif" },
  { label: "System UI (sans)", value: "system-ui, sans-serif" },
  { label: "JetBrains Mono (mono)", value: '"JetBrains Mono", ui-monospace, monospace' },
] as const;

export const IMAGE_RATIOS = ["16/9", "3/2", "4/3", "1/1", "3/4"] as const;

export const DEFAULT_BLOG_SETTINGS: BlogSettings = {
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively fill missing keys from `defaults`. Stored values always win. */
export function mergeBlogSettings(stored: unknown): BlogSettings {
  const merge = (base: any, incoming: any): any => {
    if (!isObject(base)) return incoming === undefined ? base : incoming;
    const out: Record<string, unknown> = { ...base };
    if (!isObject(incoming)) return out;
    for (const key of Object.keys(base)) {
      if (key in incoming) {
        out[key] = merge(base[key], (incoming as any)[key]);
      }
    }
    return out;
  };
  return merge(DEFAULT_BLOG_SETTINGS, stored) as BlogSettings;
}

/** CSS custom properties consumed by the public blog + admin preview. */
export function blogThemeVars(settings: BlogSettings): Record<string, string> {
  const t = settings.typography;
  return {
    "--blog-bg": t.background,
    "--blog-text": t.text,
    "--blog-link": t.link,
    "--blog-accent": t.accent,
    "--blog-font-heading": t.headingFont,
    "--blog-font-body": t.bodyFont,
    "--blog-font-size": `${t.baseSize}px`,
    "--blog-heading-scale": String(t.headingScale),
    "--blog-line-height": String(t.lineHeight),
    "--blog-content-width": `${t.contentWidth}rem`,
    "--blog-image-spacing": `${t.imageSpacing}rem`,
    "--blog-paragraph-spacing": `${t.paragraphSpacing}rem`,
  };
}
