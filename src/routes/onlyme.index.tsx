/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { publishAll, getBlogOverview } from "@/lib/server-fns";

export const Route = createFileRoute("/onlyme/")({
  component: Dashboard,
});

function Dashboard() {
  const [publishing, setPublishing] = React.useState(false);
  const [publishStatus, setPublishStatus] = React.useState<"idle" | "ok" | "error">("idle");
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (getBlogOverview as any)()
      .then((o: any) => setOverview(o))
      .catch(() => setOverview({}))
      .finally(() => setLoading(false));
  }, []);

  async function handlePublishAll() {
    setPublishing(true);
    try {
      await (publishAll as any)({ data: {} });
      setPublishStatus("ok");
      setTimeout(() => setPublishStatus("idle"), 2000);
    } catch {
      setPublishStatus("error");
      setTimeout(() => setPublishStatus("idle"), 2000);
    } finally {
      setPublishing(false);
    }
  }

  const stat = (
    label: string,
    value: number | string,
    kind: "ok" | "muted" | "amber" = "muted",
  ) => {
    const colors = {
      ok: "text-emerald-700 border-emerald-600/20 bg-emerald-600/10",
      muted: "text-muted-foreground border-border bg-muted",
      amber: "text-amber-700 border-amber-500/20 bg-amber-500/10",
    };
    return (
      <div className={`border rounded-lg p-4 ${colors[kind]}`}>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-medium text-foreground">{value}</p>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pages", to: "/onlyme/pages", icon: "📄" },
          { label: "Projects", to: "/onlyme/projects", icon: "💼" },
          { label: "Blogs", to: "/onlyme/blogs", icon: "📝" },
          { label: "Settings", to: "/onlyme/settings", icon: "⚙️" },
        ].map((card) => (
          <a
            key={card.label}
            href={card.to}
            className="block border border-border rounded-lg p-6 hover:bg-muted transition-colors group"
          >
            <span className="text-2xl">{card.icon}</span>
            <h3 className="mt-2 text-lg font-medium text-foreground">{card.label}</h3>
          </a>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {loading ? (
          <div className="col-span-4 flex items-center justify-center py-10 text-muted-foreground">
            <span className="animate-pulse">Loading…</span>
          </div>
        ) : (
          <>
            {stat("Articles", overview?.total ?? 0, "muted")}
            {stat("Published", overview?.published ?? 0, "ok")}
            {stat("Drafts", overview?.drafts ?? 0, "muted")}
            {stat("Scheduled", overview?.scheduled ?? 0, "amber")}
          </>
        )}
      </div>

      <div className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Publish all</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Copies every staged change across pages, projects, blogs, and settings into the published
          copy. The public site reads published only.
        </p>
        <button
          onClick={handlePublishAll}
          disabled={publishing}
          className="bg-primary px-6 py-3 text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-colors"
        >
          {publishing ? "Publishing…" : publishStatus === "ok" ? "Published ✓" : "Publish all"}
        </button>
        {publishStatus === "error" && (
          <p className="mt-2 text-sm text-destructive">Publish failed. Try again.</p>
        )}
      </div>

      {(overview?.recent?.length || 0) > 0 && (
        <div className="border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Recently updated</h2>
          <ul className="space-y-2 text-sm">
            {overview.recent.slice(0, 5).map((item: any) => (
              <li key={item.slug} className="border-b border-border pb-2 last:border-b-0">
                <Link
                  to="/onlyme/blogs/$slug"
                  params={{ slug: item.slug }}
                  className="text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.isPublic ? "live" : "draft"}
                  {item.publishedAt
                    ? ` · scheduled ${new Date(item.publishedAt).toLocaleDateString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(overview?.topViewed?.length || 0) > 0 && (
        <div className="border border-border rounded-lg p-6 mt-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Most viewed</h2>
          <ul className="space-y-2 text-sm">
            {overview.topViewed.map((item: any) => (
              <li key={item.slug} className="border-b border-border pb-2 last:border-b-0">
                <Link
                  to="/blog/$slug"
                  params={{ slug: item.slug }}
                  className="text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.views} view{item.views === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
