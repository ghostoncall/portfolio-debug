/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { listStaged, publishItem, revertItem } from "@/lib/server-fns";

export const Route = createFileRoute("/onlyme/pages")({
  component: Pages,
});

function Pages() {
  const [items, setItems] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState<{
    slug: string;
    kind: "idle" | "ok" | "error";
  } | null>(null);

  React.useEffect(() => {
    (listStaged as any)({ data: { table: "pages" } }).then((rows: any) => setItems(rows));
  }, []);

  async function handlePublish(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (publishItem as any)({ data: { table: "pages", slug } });
      setStatus({ slug, kind: "ok" });
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleRevert(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (revertItem as any)({ data: { table: "pages", slug } });
      const rows = await (listStaged as any)({ data: { table: "pages" } });
      setItems(rows as any);
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h2 className="text-lg font-medium text-foreground">Pages</h2>
      </div>

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
                Kind
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Updated
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody data-testid="pages-table">
            {items.map((item) => {
              const dedicatedAdmins: Record<string, string> = {
                skills: "/onlyme/skills",
                certificates: "/onlyme/certificates",
                experience: "/onlyme/experience",
              };
              const isAdminLink = Boolean(dedicatedAdmins[item.published.kind ?? ""]);
              return (
                <tr key={item.slug} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{item.slug}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.published.title || item.staged.title}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.published.kind || item.staged.kind}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isAdminLink ? (
                      <Link
                        to={(dedicatedAdmins[item.published.kind] ?? "/onlyme/pages") as never}
                        className="text-sm text-primary underline"
                        data-testid="page-edit-link"
                      >
                        Edit
                      </Link>
                    ) : (
                      <Link
                        to="/onlyme/pages/$slug"
                        params={{ slug: item.slug }}
                        className="text-sm text-primary underline"
                        data-testid="page-edit-link"
                      >
                        Edit
                      </Link>
                    )}{" "}
                    <button
                      onClick={() => handlePublish(item.slug)}
                      disabled={status?.slug === item.slug}
                      className="ml-2 text-xs text-success hover:underline"
                      data-testid="page-publish-button"
                    >
                      Publish
                    </button>{" "}
                    <button
                      onClick={() => handleRevert(item.slug)}
                      disabled={status?.slug === item.slug}
                      className="ml-2 text-xs text-destructive hover:underline"
                      data-testid="page-revert-button"
                    >
                      Revert
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
                  No pages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
