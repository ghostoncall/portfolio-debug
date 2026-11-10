/* eslint-disable @typescript-eslint/no-explicit-any */
// Post editor: metadata + Ghost Koenig body + publishing workflow.
//
// Saved model:
//   staged  — the working draft the author edits (autosaved)
//   published — the live copy; only publishing copies staged → published
//
// Legacy posts (Block[]) are converted to HTML on first open and written to
// `staged` only, so the published copy keeps rendering until the author
// explicitly publishes the converted body.
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Maximize, Minimize, ImageIcon, Loader2, X } from "lucide-react";
import {
  deleteItem,
  getStaged,
  publishItem,
  revertItem,
  unpublishItem,
  updatePostSlug,
  updateStaged,
} from "@/lib/server-fns";
import { KoenigBodyEditor } from "@/components/admin/KoenigBodyEditor";
import { FontSizeToolbar } from "@/components/admin/FontSizeToolbar";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { BlogRenderer } from "@/components/admin/BlogRenderer";
import type { MediaItem } from "@/components/media";
import { blocksToHtml } from "@/lib/blocks-to-html";
import { blogThemeVars, DEFAULT_BLOG_SETTINGS } from "@/lib/blog-settings";
import type { Post, PostBody, PostVisibility } from "@/content/site";

export const Route = createFileRoute("/onlyme/blogs/$slug")({
  component: PostEditor,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring disabled:opacity-60";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

const PREVIEW_MODES: Array<"editor" | "preview" | "split"> = ["editor", "preview", "split"];
const DEVICE_TYPES: Array<"desktop" | "tablet" | "mobile"> = ["desktop", "tablet", "mobile"];

type Form = {
  title: string;
  slug: string;
  dek: string;
  author: string;
  date: string;
  readTime: string;
  tags: string;
  featured: boolean;
  visibility: PostVisibility;
  cover: MediaItem | undefined;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  socialImage: string;
  body: PostBody | null;
};

function toForm(post: Post): Form {
  return {
    title: post.title ?? "",
    slug: post.slug,
    dek: post.dek ?? "",
    author: post.author ?? "",
    date: post.date ?? new Date().toISOString().slice(0, 10),
    readTime: post.readTime ?? "",
    tags: (post.tags ?? []).join(", "),
    featured: Boolean(post.featured),
    visibility: post.visibility ?? "public",
    cover: post.cover,
    seoTitle: post.seo?.title ?? "",
    seoDescription: post.seo?.description ?? "",
    canonical: post.seo?.canonical ?? "",
    socialImage: post.seo?.socialImage ?? "",
    body: post.body ?? null,
  };
}

function buildDoc(form: Form, base: Post, slug: string): Post {
  const tags = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const seo: { title?: string; description?: string; canonical?: string; socialImage?: string } =
    {};
  if (form.seoTitle.trim()) seo.title = form.seoTitle.trim();
  if (form.seoDescription.trim()) seo.description = form.seoDescription.trim();
  if (form.canonical.trim()) seo.canonical = form.canonical.trim();
  if (form.socialImage.trim()) seo.socialImage = form.socialImage.trim();

  const doc: Post = {
    ...base,
    slug,
    title: form.title.trim() || "Untitled post",
    dek: form.dek.trim(),
    date: form.date || new Date().toISOString().slice(0, 10),
    tags,
    blocks: base.blocks ?? [],
    author: form.author.trim() || undefined,
    featured: form.featured || undefined,
    visibility: form.visibility,
    cover: (form.cover?.src ? form.cover : undefined) as MediaItem | undefined,
    seo: Object.keys(seo).length ? seo : undefined,
  };
  if (form.readTime.trim()) doc.readTime = form.readTime.trim();
  else delete doc.readTime;
  if (form.body) doc.body = form.body;
  return doc;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function errorMessage(error: unknown): string {
  const anyError = error as any;
  return anyError?.message ?? anyError?.data?.message ?? "Something went wrong.";
}

function StatusBadge({ isPublic, publishedAt }: { isPublic: boolean; publishedAt: string | null }) {
  if (isPublic && publishedAt && new Date(publishedAt).getTime() > Date.now()) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
        Scheduled · {new Date(publishedAt).toLocaleString()}
      </span>
    );
  }
  if (isPublic) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-700">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Draft
    </span>
  );
}

export function PostEditor() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Post | null>(null);
  const [published, setPublished] = useState<Post | null>(null);
  const [currentSlug, setCurrentSlug] = useState(params.slug);
  const [isPublic, setIsPublic] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [converted, setConverted] = useState(false);
  const [fontSize, setFontSize] = useState("16px");
  const [zoomLevel, setZoomLevel] = useState("100");
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<"editor" | "preview" | "split">("editor");
  const [deviceType, setDeviceType] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem("onlyme:rightSidebarCollapsed");
      if (v !== null) setRightSidebarCollapsed(v === "true");
      const f = localStorage.getItem("onlyme:focusMode");
      if (f !== null) setFocusMode(f === "true");
      const p = localStorage.getItem("onlyme:previewMode");
      if (p !== null) setPreviewMode(p as "editor" | "preview" | "split");
      const d = localStorage.getItem("onlyme:deviceType");
      if (d !== null) setDeviceType(d as "desktop" | "tablet" | "mobile");
    } catch {
      // Ignore storage errors
    }
  }, []);

  const formRef = useRef<Form | null>(null);
  const baseRef = useRef<Post | null>(null);
  const slugRef = useRef(params.slug);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);

  formRef.current = form;
  baseRef.current = base;
  slugRef.current = currentSlug;
  dirtyRef.current = dirty;

  const notify = (kind: "ok" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  function toggleRightSidebar() {
    setRightSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("onlyme:rightSidebarCollapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  function toggleFocusMode() {
    setFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("onlyme:focusMode", String(next));
      } catch {
        // Ignore storage errors
      }
      // When entering focus mode, also collapse sidebars
      if (next) {
        setRightSidebarCollapsed(true);
      }
      return next;
    });
  }

  function setPreviewModeVal(mode: "editor" | "preview" | "split") {
    setPreviewMode(mode);
    try {
      localStorage.setItem("onlyme:previewMode", mode);
    } catch {
      // Ignore storage errors
    }
  }

  function setDevice(val: "desktop" | "tablet" | "mobile") {
    setDeviceType(val);
    try {
      localStorage.setItem("onlyme:deviceType", val);
    } catch {
      // Ignore storage errors
    }
  }

  const load = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const data: any = await (getStaged as any)({ data: { table: "posts", slug } });
      let staged = data.staged as Post;

      // One-time conversion of pre-Koenig posts. Written to staged only.
      if (!staged.body && Array.isArray(staged.blocks) && staged.blocks.length > 0) {
        const html = blocksToHtml(staged.blocks);
        staged = { ...staged, body: { lexical: {}, html } };
        await (updateStaged as any)({
          data: { table: "posts", slug, content: staged, kind: "post" },
        });
        setConverted(true);
      }

      setBase(staged);
      setPublished((data.published as Post) ?? null);
      setForm(toForm(staged));
      setCurrentSlug(slug);
      setIsPublic(Boolean(data.isPublic));
      setPublishedAt(data.publishedAt ?? null);
      setDirty(false);
      setLoading(false);
      const scheduledFuture =
        data.publishedAt && new Date(data.publishedAt).getTime() > Date.now()
          ? toLocalInput(data.publishedAt)
          : "";
      setScheduleAt(scheduledFuture);
    } catch (error) {
      setLoading(false);
      notify("error", errorMessage(error));
    }
  }, []);

  useEffect(() => {
    slugRef.current = params.slug;
    setCurrentSlug(params.slug);
    void load(params.slug);
  }, [params.slug, load]);

  const patch = (next: Partial<Form>) => {
    setForm((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  };

  const save = useCallback(
    async (options: { applySlug?: boolean; silent?: boolean } = {}) => {
      const current = formRef.current;
      const baseline = baseRef.current;
      if (!current || !baseline) return false;
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        let slug = slugRef.current;
        if (options.applySlug !== false && current.slug !== slug) {
          const result: any = await (updatePostSlug as any)({
            data: { oldSlug: slug, newSlug: current.slug.trim() },
          });
          slug = result.slug;
          slugRef.current = slug;
          setCurrentSlug(slug);
          void navigate({ to: "/onlyme/blogs/$slug", params: { slug }, replace: true });
        }

        const doc = buildDoc(current, baseline, slug);
        await (updateStaged as any)({
          data: { table: "posts", slug, content: doc, kind: "post" },
        });
        baseRef.current = doc;
        setBase(doc);
        setLastSaved(new Date());
        setDirty(current.slug !== slug);
        if (!options.silent) notify("ok", options.applySlug === false ? "Draft saved." : "Saved.");
        return true;
      } catch (error) {
        if (!options.silent) notify("error", errorMessage(error));
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [navigate],
  );

  // Autosave: debounce edits. Slug renames are only applied by an explicit save.
  useEffect(() => {
    if (!dirty || loading || !form) return;
    const timer = window.setTimeout(() => void save({ applySlug: false, silent: true }), 2500);
    return () => window.clearTimeout(timer);
  }, [form, dirty, loading, save]);

  // Warn before losing unsaved edits.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handlePublish = async (mode: "now" | "schedule") => {
    if (!form) return;
    if (mode === "schedule") {
      if (!scheduleAt) {
        notify("error", "Choose a date and time to schedule this post.");
        return;
      }
      if (new Date(scheduleAt).getTime() <= Date.now()) {
        notify("error", "The scheduled time must be in the future.");
        return;
      }
    }
    const saved = await save({ applySlug: true });
    if (!saved) return;
    try {
      setSaving(true);
      await (publishItem as any)({
        data: {
          table: "posts",
          slug: slugRef.current,
          ...(mode === "schedule" ? { publishAt: new Date(scheduleAt).toISOString() } : {}),
        },
      });
      const data: any = await (getStaged as any)({
        data: { table: "posts", slug: slugRef.current },
      });
      setPublished(data.published as Post);
      setIsPublic(Boolean(data.isPublic));
      setPublishedAt(data.publishedAt ?? null);
      setDirty(false);
      notify(
        "ok",
        mode === "schedule"
          ? `Scheduled for ${new Date(scheduleAt).toLocaleString()}.`
          : "Post is live.",
      );
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm("Take this post off the public site? The published copy is kept.")) return;
    try {
      setSaving(true);
      await (unpublishItem as any)({ data: { table: "posts", slug: slugRef.current } });
      setIsPublic(false);
      notify("ok", "Post unpublished.");
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!window.confirm("Discard the draft and restore the published version?")) return;
    try {
      setSaving(true);
      await (revertItem as any)({ data: { table: "posts", slug: slugRef.current } });
      await load(slugRef.current);
      notify("ok", "Reverted to the published version.");
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(`Delete “${form?.title || currentSlug}” permanently? This cannot be undone.`)
    )
      return;
    try {
      setSaving(true);
      await (deleteItem as any)({ data: { table: "posts", slug: slugRef.current } });
      void navigate({ to: "/onlyme/blogs" });
    } catch (error) {
      notify("error", errorMessage(error));
      setSaving(false);
    }
  };

  if (loading && !form) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading post…
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Could not load this post.</p>
        <Link to="/onlyme/blogs" className="text-sm text-link hover:underline">
          ← Back to blogs
        </Link>
      </div>
    );
  }

  const hasLexical = Boolean(
    form.body && form.body.lexical && Object.keys(form.body.lexical).length > 0,
  );

  // Changes Pending: published copy exists but staged differs from it.
  const changesPending = Boolean(
    published && base && JSON.stringify(base) !== JSON.stringify(published),
  );

  const vars = blogThemeVars(DEFAULT_BLOG_SETTINGS);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/onlyme/blogs" className="text-sm text-muted-foreground hover:underline">
            ← Blogs
          </Link>
          <StatusBadge isPublic={isPublic} publishedAt={publishedAt} />
          {changesPending ? (
            <span className="text-xs text-amber-700">Changes pending — publish to go live</span>
          ) : dirty ? (
            <span className="text-xs text-amber-700">Unsaved changes</span>
          ) : lastSaved ? (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
          {converted && (
            <span className="text-xs text-muted-foreground">
              Converted from the legacy block editor
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.open(`/onlyme/preview/${currentSlug}`, "_blank")}
            className="border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            Preview
          </button>
          <FontSizeToolbar value={fontSize} onChange={setFontSize} />
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Zoom</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(50, Number(z) - 10).toString())}
              className="text-xs border border-input px-1.5 py-1 rounded hover:bg-accent"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-xs font-mono">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(200, Number(z) + 10).toString())}
              className="text-xs border border-input px-1.5 py-1 rounded hover:bg-accent"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel("100")}
              className="text-xs text-muted-foreground hover:text-destructive underline"
              title="Reset zoom"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={toggleRightSidebar}
            className="border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
            title="Toggle settings panel"
          >
            {rightSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleFocusMode}
            className={`border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 ${
              focusMode ? "bg-amber-100 text-amber-700" : ""
            }`}
            title="Focus mode"
          >
            {focusMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Preview
            </span>
            {PREVIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewModeVal(mode)}
                className={`text-xs border rounded px-2 py-1 ${
                  previewMode === mode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {mode === "editor" ? "Editor" : mode === "preview" ? "Preview" : "Split"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Device
            </span>
            {DEVICE_TYPES.map((dev) => (
              <button
                key={dev}
                type="button"
                onClick={() => setDevice(dev)}
                className={`text-xs border rounded px-2 py-1 ${
                  deviceType === dev
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {dev === "desktop" ? "Desktop" : dev === "tablet" ? "Tablet" : "Mobile"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              await save({ applySlug: true });
              navigate({ to: "/onlyme/blogs" });
            }}
            disabled={saving}
            className="border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
          >
            {saving ? "Saving…" : "Done"}
          </button>
          <button
            type="button"
            onClick={() => void handlePublish("now")}
            disabled={saving}
            className={`bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 ${
              changesPending ? "bg-amber-600 text-amber-50 hover:bg-amber-700" : ""
            }`}
          >
            {isPublic ? "Publish Updates" : "Publish now"}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div
        className={`grid gap-8 ${
          rightSidebarCollapsed || focusMode || previewMode === "split"
            ? "lg:grid-cols-[1fr]"
            : "lg:grid-cols-[minmax(0,1fr)_22rem]"
        }`}
      >
        {previewMode === "preview" ? (
          <div className="min-w-0">
            <div className="space-y-2 border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">Live Preview</h2>
                <div className="flex items-center gap-2">
                  {DEVICE_TYPES.map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => setDevice(dev)}
                      className={`text-xs border rounded px-2 py-1 ${
                        deviceType === dev
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {dev === "desktop" ? "Desktop" : dev === "tablet" ? "Tablet" : "Mobile"}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPreviewModeVal("editor")}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Back to editor
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-[70vh] overflow-auto">
              <div
                className={`mx-auto my-4 ${
                  deviceType === "mobile"
                    ? "max-w-xs"
                    : deviceType === "tablet"
                      ? "max-w-lg"
                      : "max-w-3xl"
                }`}
              >
                <BlogRenderer post={form as unknown as Post} themeVars={vars} />
              </div>
            </div>
          </div>
        ) : previewMode === "split" ? (
          <>
            <div className="min-w-0 space-y-6">
              <div className="space-y-4 border border-border p-5">
                <label className="block">
                  <span className={label}>Title</span>
                  <textarea
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    rows={2}
                    placeholder="Post title"
                    className="w-full resize-none border-0 border-b border-input bg-transparent px-0 py-2 font-display text-3xl leading-tight text-foreground outline-none focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className={label}>Excerpt / dek</span>
                  <textarea
                    value={form.dek}
                    onChange={(e) => patch({ dek: e.target.value })}
                    rows={2}
                    placeholder="One or two sentences shown on the blog index and in search results."
                    className={`${field} resize-y`}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Body</h3>
                  <span className="text-xs text-muted-foreground">
                    Autosaves to draft · use Save before publishing URL changes
                  </span>
                </div>
                <div
                  className="relative"
                  style={{
                    transform: `scale(${Number(zoomLevel) / 100})`,
                    transformOrigin: "top left",
                    width: `${100 / (Number(zoomLevel) / 100)}%`,
                  }}
                >
                  <KoenigBodyEditor
                    initialLexical={hasLexical ? form.body!.lexical : null}
                    initialHtml={form.body?.html ?? ""}
                    fontSize={fontSize}
                    onFontSizeChange={setFontSize}
                    onChange={(value) => {
                      setForm((prev) => (prev ? { ...prev, body: value } : prev));
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0 border-l border-border pl-6">
              <div className="space-y-2 border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-foreground">Live Preview</h2>
                  <div className="flex items-center gap-2">
                    {DEVICE_TYPES.map((dev) => (
                      <button
                        key={dev}
                        type="button"
                        onClick={() => setDevice(dev)}
                        className={`text-xs border rounded px-2 py-1 ${
                          deviceType === dev
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {dev === "desktop" ? "Desktop" : dev === "tablet" ? "Tablet" : "Mobile"}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPreviewModeVal("editor")}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Back to editor
                    </button>
                  </div>
                </div>
              </div>
              <div className="min-h-[70vh] overflow-auto">
                <div
                  className={`mx-auto my-4 ${
                    deviceType === "mobile"
                      ? "max-w-xs"
                      : deviceType === "tablet"
                        ? "max-w-lg"
                        : "max-w-3xl"
                  }`}
                >
                  <BlogRenderer post={form as unknown as Post} themeVars={vars} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 space-y-6">
              <div className="space-y-4 border border-border p-5">
                <label className="block">
                  <span className={label}>Title</span>
                  <textarea
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    rows={2}
                    placeholder="Post title"
                    className="w-full resize-none border-0 border-b border-input bg-transparent px-0 py-2 font-display text-3xl leading-tight text-foreground outline-none focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className={label}>Excerpt / dek</span>
                  <textarea
                    value={form.dek}
                    onChange={(e) => patch({ dek: e.target.value })}
                    rows={2}
                    placeholder="One or two sentences shown on the blog index and in search results."
                    className={`${field} resize-y`}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Body</h3>
                  <span className="text-xs text-muted-foreground">
                    Autosaves to draft · use Save before publishing URL changes
                  </span>
                </div>
                <div
                  className="relative"
                  style={{
                    transform: `scale(${Number(zoomLevel) / 100})`,
                    transformOrigin: "top left",
                    width: `${100 / (Number(zoomLevel) / 100)}%`,
                  }}
                >
                  <KoenigBodyEditor
                    initialLexical={hasLexical ? form.body!.lexical : null}
                    initialHtml={form.body?.html ?? ""}
                    fontSize={fontSize}
                    onFontSizeChange={setFontSize}
                    onChange={(value) => {
                      setForm((prev) => (prev ? { ...prev, body: value } : prev));
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
            </div>

            {!rightSidebarCollapsed && !focusMode && (
              <aside className="space-y-4">
                <section className="space-y-3 border border-border p-4">
                  <h3 className="text-sm font-medium text-foreground">Publishing</h3>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge isPublic={isPublic} publishedAt={publishedAt} />
                  </div>

                  <label className="block">
                    <span className={label}>Schedule for</span>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className={field}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handlePublish("schedule")}
                    disabled={saving || !scheduleAt}
                    className="w-full border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {isPublic ? "Reschedule" : "Schedule publish"}
                  </button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Scheduling is enforced by the server: the post stays hidden from the public site
                    until the chosen time.
                  </p>

                  <div className="space-y-2 border-t border-border pt-3">
                    {isPublic && (
                      <button
                        type="button"
                        onClick={() => void handleUnpublish()}
                        disabled={saving}
                        className="w-full border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRevert()}
                      disabled={saving}
                      className="w-full border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                    >
                      Revert to published
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={saving}
                      className="w-full border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Delete post
                    </button>
                  </div>
                </section>

                <section className="space-y-3 border border-border p-4">
                  <h3 className="text-sm font-medium text-foreground">Post details</h3>

                  <label className="block">
                    <span className={label}>URL slug</span>
                    <div className="flex gap-2">
                      <input
                        value={form.slug}
                        onChange={(e) => patch({ slug: e.target.value })}
                        className={`${field} font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => patch({ slug: slugify(form.title) })}
                        className="shrink-0 border border-input px-2 text-xs text-muted-foreground hover:bg-accent"
                        title="Generate from title"
                      >
                        From title
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      /blog/{form.slug || "your-slug"} — applies when you save or publish.
                    </p>
                  </label>

                  <label className="block">
                    <span className={label}>Author</span>
                    <input
                      value={form.author}
                      onChange={(e) => patch({ author: e.target.value })}
                      placeholder="Author name"
                      className={field}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={label}>Display date</span>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => patch({ date: e.target.value })}
                        className={field}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>Read time</span>
                      <input
                        value={form.readTime}
                        onChange={(e) => patch({ readTime: e.target.value })}
                        placeholder="6 min read"
                        className={field}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={label}>Tags / categories</span>
                    <input
                      value={form.tags}
                      onChange={(e) => patch({ tags: e.target.value })}
                      placeholder="RAG, Agents, Evaluation"
                      className={field}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Comma-separated.</p>
                  </label>

                  <label className="block">
                    <span className={label}>Visibility</span>
                    <select
                      value={form.visibility}
                      onChange={(e) => patch({ visibility: e.target.value as PostVisibility })}
                      className={field}
                    >
                      <option value="public">Public — listed on the blog</option>
                      <option value="unlisted">Unlisted — reachable by URL only</option>
                      <option value="private">Private — admin only</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => patch({ featured: e.target.checked })}
                    />
                    Feature on the blog index
                  </label>
                </section>

                <section className="space-y-3 border border-border p-4">
                  <h3 className="text-sm font-medium text-foreground">Featured image</h3>
                  <ImageField
                    label="Cover"
                    value={form.cover}
                    onChange={(cover) => patch({ cover })}
                    withAltCaption
                  />
                </section>

                <section className="space-y-3 border border-border p-4">
                  <h3 className="text-sm font-medium text-foreground">SEO & sharing</h3>
                  <label className="block">
                    <span className={label}>SEO title</span>
                    <input
                      value={form.seoTitle}
                      onChange={(e) => patch({ seoTitle: e.target.value })}
                      placeholder={form.title || "Defaults to the post title"}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>SEO description</span>
                    <textarea
                      value={form.seoDescription}
                      onChange={(e) => patch({ seoDescription: e.target.value })}
                      rows={3}
                      placeholder={form.dek || "Defaults to the excerpt"}
                      className={`${field} resize-y`}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Canonical URL</span>
                    <input
                      value={form.canonical}
                      onChange={(e) => patch({ canonical: e.target.value })}
                      placeholder="https://example.com/original-post"
                      className={field}
                    />
                  </label>
                  <ImageField
                    label="Social share image"
                    value={{ src: form.socialImage }}
                    onChange={(value) => patch({ socialImage: value.src ?? "" })}
                  />
                </section>

                {published && (
                  <section className="space-y-2 border border-border p-4 text-xs text-muted-foreground">
                    <h3 className="text-sm font-medium text-foreground">Live version</h3>
                    <p className="truncate">{published.title}</p>
                    <p>{published.date}</p>
                    {isPublic && (
                      <Link
                        to="/blog/$slug"
                        params={{ slug: published.slug }}
                        target="_blank"
                        className="inline-block text-link hover:underline"
                      >
                        View live post ↗
                      </Link>
                    )}
                  </section>
                )}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ImageField({
  label: fieldLabel,
  value,
  onChange,
  withAltCaption = false,
}: {
  label: string;
  value?: { src?: string; alt?: string; caption?: string } | null | undefined;
  onChange: (value: { src?: string; alt?: string; caption?: string }) => void;
  withAltCaption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const item = value ?? {};
  return (
    <div className="space-y-2">
      <span className={label}>{fieldLabel}</span>
      <div className="flex gap-2">
        <input
          value={value?.src ?? ""}
          onChange={(e) => onChange({ ...(value ?? {}), src: e.target.value })}
          placeholder="Image URL"
          className={field}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 border border-input px-2 text-xs text-muted-foreground hover:bg-accent"
          title="Choose from the media library"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </div>
      {item.src ? (
        <>
          <div className="relative aspect-[16/9] overflow-hidden border border-border bg-muted">
            <img
              src={item.src}
              alt={item.alt ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => onChange({ ...item, src: "" })}
              className="absolute right-1 top-1 bg-background/90 p-1 text-muted-foreground hover:text-destructive"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {withAltCaption && (
            <>
              <input
                value={item.alt ?? ""}
                onChange={(e) => onChange({ ...item, alt: e.target.value })}
                placeholder="Alt text — describe the image for screen readers"
                className={field}
              />
              <input
                value={item.caption ?? ""}
                onChange={(e) => onChange({ ...item, caption: e.target.value })}
                placeholder="Caption shown under the image"
                className={field}
              />
            </>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Optional. Choose from the media library or paste a URL.
        </p>
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        accept="image"
        title={fieldLabel}
        onSelect={(asset) =>
          onChange({
            ...item,
            src: asset.url,
            alt: item.alt || asset.alt || asset.name,
          })
        }
      />
    </div>
  );
}
