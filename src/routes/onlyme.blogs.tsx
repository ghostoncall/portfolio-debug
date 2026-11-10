/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createItem,
  deleteItem,
  listStaged,
  publishItem,
  revertItem,
  unpublishItem,
} from "@/lib/server-fns";

export const Route = createFileRoute("/onlyme/blogs")({
  component: Blogs,
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function Blogs() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isListPage = pathname === "/onlyme/blogs";
  const [items, setItems] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState<{
    slug: string;
    kind: "idle" | "ok" | "error";
  } | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!isListPage) return;
    (listStaged as any)({ data: { table: "posts" } }).then((rows: any) => setItems(rows));
  }, [isListPage]);

  async function refresh() {
    const rows = await (listStaged as any)({ data: { table: "posts" } });
    setItems(rows as any);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      await (createItem as any)({ data: { table: "posts", slug, title } });
      setBusy(false);
      setCreating(false);
      navigate({ to: "/onlyme/blogs/$slug", params: { slug } });
    } catch (err: any) {
      setBusy(false);
      setCreateError(err.message ?? "Could not create post");
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Delete "${slug}" permanently? This cannot be undone.`)) return;
    setStatus({ slug, kind: "idle" });
    try {
      await (deleteItem as any)({ data: { table: "posts", slug } });
      await refresh();
      setStatus({ slug, kind: "ok" });
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handlePublish(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (publishItem as any)({ data: { table: "posts", slug } });
      setStatus({ slug, kind: "ok" });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleRevert(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (revertItem as any)({ data: { table: "posts", slug } });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleUnpublish(slug: string) {
    if (!window.confirm(`Take this post off the public site? The published copy is kept.`)) return;
    setStatus({ slug, kind: "ok" });
    try {
      await (unpublishItem as any)({ data: { table: "posts", slug } });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  return (
    <div className="space-y-6">
      {isListPage && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
                ← Back
              </Link>
              <h2 className="text-lg font-medium text-foreground">Blogs</h2>
            </div>
            <button
              onClick={() => setCreating((c) => !c)}
              className="bg-primary px-4 py-2 text-sm text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-colors"
            >
              {creating ? "Cancel" : "+ New post"}
            </button>
          </div>

          {creating && (
            <form
              onSubmit={handleCreate}
              className="border border-border rounded-lg p-5 space-y-4 bg-muted/30"
            >
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="My first post"
                  required
                  className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-1">
                  Slug (the URL — /blog/your-slug)
                </span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="my-first-post"
                  required
                  className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-mono"
                />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <button
                type="submit"
                disabled={busy || !title.trim() || !slug.trim()}
                className="bg-primary px-5 py-2 text-sm text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-colors"
              >
                {busy ? "Creating…" : "Create & start writing"}
              </button>
            </form>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const p = item.published as any;
                  const s = item.staged as any;
                  const isPublic = Boolean(item.isPublic);
                  const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
                  const isScheduled = isPublic && publishedAt && publishedAt.getTime() > Date.now();
                  const stagedChanged = JSON.stringify(s) !== JSON.stringify(p);
                  const statusLabel = isScheduled
                    ? { text: "Scheduled", kind: "amber" as const }
                    : isPublic
                      ? stagedChanged
                        ? { text: "Changes Pending", kind: "amber" as const }
                        : { text: "Published", kind: "green" as const }
                      : { text: "Draft", kind: "muted" as const };

                  return (
                    <tr key={item.slug} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                        {item.slug}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{p?.title}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p?.date}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`text-xs inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${
                            statusLabel.kind === "green"
                              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                              : statusLabel.kind === "amber"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                                : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/onlyme/blogs/$slug"
                          params={{ slug: item.slug }}
                          className="text-sm text-primary underline"
                        >
                          Edit
                        </Link>{" "}
                        {isPublic && !isScheduled ? (
                          <>
                            <button
                              onClick={() => handlePublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-amber-700 hover:underline"
                            >
                              Publish Updates
                            </button>{" "}
                            <button
                              onClick={() => handleUnpublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-destructive hover:underline"
                            >
                              Unpublish
                            </button>{" "}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-success hover:underline"
                            >
                              Publish
                            </button>{" "}
                          </>
                        )}
                        <button
                          onClick={() => handleRevert(item.slug)}
                          disabled={status?.slug === item.slug}
                          className="ml-2 text-xs text-muted-foreground hover:underline"
                        >
                          Revert
                        </button>{" "}
                        <button
                          onClick={() => handleDelete(item.slug)}
                          disabled={status?.slug === item.slug}
                          className="ml-2 text-xs text-destructive hover:underline"
                        >
                          Delete
                        </button>
                        {status && status.slug === item.slug && status.kind === "ok" && (
                          <span className="ml-2 text-xs text-success">✓</span>
                        )}
                        {status && status.slug === item.slug && status.kind === "error" && (
                          <span className="ml-2 text-xs text-destructive">✗</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                      No posts yet — click "+ New post" to write your first one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Outlet />
    </div>
  );
}

import React from "react";
