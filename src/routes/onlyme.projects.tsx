/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createItem,
  deleteProject,
  duplicateProject,
  listStaged,
  publishItem,
  reorderProjects,
  revertItem,
} from "@/lib/server-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/cms/ConfirmDialog";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { SortableList } from "@/components/admin/cms/SortableList";
import { GripVertical } from "lucide-react";

export const Route = createFileRoute("/onlyme/projects")({
  component: Projects,
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

type Row = {
  slug: string;
  published: any;
  staged: any;
  isPublic: boolean;
  publishedAt: string | null;
  updatedAt: string;
  sort: number;
};

function Projects() {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Row | null>(null);
  const [dupTarget, setDupTarget] = React.useState<Row | null>(null);
  const [dupSlug, setDupSlug] = React.useState("");
  const [dupTitle, setDupTitle] = React.useState("");

  const refresh = React.useCallback(async () => {
    const rows = (await (listStaged as any)({ data: { table: "projects" } })) as Row[];
    rows.sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
    setItems(rows);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      await (createItem as any)({ data: { table: "projects", slug, title } });
      navigate({ to: "/onlyme/projects/$slug", params: { slug } });
    } catch (err: any) {
      setCreateError(err.message ?? "Could not create project");
      setBusy(false);
    }
  }

  async function handlePublish(slug: string) {
    try {
      await (publishItem as any)({ data: { table: "projects", slug } });
      toast.success(`Published "${slug}"`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Publish failed");
    }
  }

  async function handleRevert(slug: string) {
    try {
      await (revertItem as any)({ data: { table: "projects", slug } });
      toast.success(`Reverted "${slug}" to the published version`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Revert failed");
    }
  }

  async function handleArchiveToggle(row: Row) {
    const p = row.staged ?? {};
    const nextStatus = p.status === "archived" ? "completed" : "archived";
    try {
      const { updateStaged } = await import("@/lib/server-fns");
      await (updateStaged as any)({
        data: { table: "projects", slug: row.slug, content: { ...p, status: nextStatus } },
      });
      toast.success(`Marked "${row.slug}" as ${nextStatus}`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change status");
    }
  }

  async function handleDelete(row: Row) {
    try {
      await (deleteProject as any)({ data: { slug: row.slug } });
      toast.success(`Deleted "${row.slug}" and cleaned its references`);
      setDeleteTarget(null);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  }

  async function handleDuplicate() {
    if (!dupTarget) return;
    try {
      await (duplicateProject as any)({
        data: { slug: dupTarget.slug, newSlug: dupSlug, title: dupTitle },
      });
      toast.success(`Duplicated as "${dupSlug}"`);
      setDupTarget(null);
      navigate({ to: "/onlyme/projects/$slug", params: { slug: dupSlug } });
    } catch (err: any) {
      toast.error(err?.message ?? "Duplicate failed");
    }
  }

  async function handleReorder(next: Row[]) {
    setItems(next);
    try {
      await (reorderProjects as any)({ data: { slugs: next.map((r) => r.slug) } });
      toast.success("Order saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Reorder failed");
      await refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Projects</h2>
          <span className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "project" : "projects"}
          </span>
        </div>
        <Button onClick={() => setCreating((c) => !c)} variant={creating ? "outline" : "default"}>
          {creating ? "Cancel" : "+ New project"}
        </Button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="border border-border rounded-lg p-5 space-y-4 bg-muted/30"
          data-testid="project-create-form"
        >
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="My project"
              required
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1">
              Slug (the URL — /projects/your-slug)
            </span>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="my-project"
              required
              className="font-mono"
            />
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <Button type="submit" disabled={busy || !title.trim() || !slug.trim()}>
            {busy ? "Creating…" : "Create & start building"}
          </Button>
        </form>
      )}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start building the portfolio."
          action={
            <Button onClick={() => setCreating(true)} variant="default">
              + New project
            </Button>
          }
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden" data-testid="project-list">
          <div className="border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
            Drag to reorder — the public list follows this order
          </div>
          <SortableList
            items={items}
            getId={(r) => r.slug}
            onReorder={handleReorder}
            renderItem={(row, { index, moveUp, moveDown }) => {
              const p = row.staged ?? row.published ?? {};
              const hasChanges = JSON.stringify(row.staged) !== JSON.stringify(row.published);
              return (
                <div
                  className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30"
                  data-testid="project-row"
                >
                  {/* Drag handle + keyboard reorder */}
                  <div className="flex flex-col items-center pt-1">
                    <span
                      className="cursor-grab text-muted-foreground"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="size-4" />
                    </span>
                    <div className="mt-1 flex">
                      <button
                        onClick={moveUp}
                        disabled={index === 0}
                        className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label={`Move ${row.slug} up`}
                      >
                        ↑
                      </button>
                      <button
                        onClick={moveDown}
                        disabled={index === items.length - 1}
                        className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label={`Move ${row.slug} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/onlyme/projects/$slug"
                        params={{ slug: row.slug }}
                        className="font-serif text-lg text-foreground hover:underline"
                      >
                        {p.title ?? row.slug}
                      </Link>
                      {row.isPublic ? (
                        <Badge variant="secondary" className="text-[0.65rem]">
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                          Draft
                        </Badge>
                      )}
                      {p.status && (
                        <Badge
                          variant={p.status === "archived" ? "destructive" : "outline"}
                          className="text-[0.65rem]"
                        >
                          {p.status}
                        </Badge>
                      )}
                      {p.featured && (
                        <Badge variant="secondary" className="text-[0.65rem]">
                          Featured
                        </Badge>
                      )}
                      {p.priority != null && (
                        <span className="text-[0.65rem] text-muted-foreground">
                          priority {p.priority}
                        </span>
                      )}
                      {hasChanges && (
                        <span className="text-[0.65rem] text-amber-600">unpublished changes</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="font-mono">{row.slug}</span>
                      <span>{p.category}</span>
                      <span>{p.year}</span>
                      <span>
                        updated {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Link
                      to="/onlyme/projects/$slug"
                      params={{ slug: row.slug }}
                      className="text-xs text-primary underline"
                    >
                      Edit
                    </Link>
                    <Link
                      to="/projects/$slug"
                      params={{ slug: row.slug }}
                      target="_blank"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Preview
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handlePublish(row.slug)}
                    >
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleRevert(row.slug)}
                    >
                      Revert
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleArchiveToggle(row)}
                    >
                      {p.status === "archived" ? "Unarchive" : "Archive"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setDupTarget(row);
                        setDupSlug(slugify(`${p.title ?? row.slug}-copy`));
                        setDupTitle(`${p.title ?? row.slug} (copy)`);
                      }}
                    >
                      Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(row)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      <Outlet />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.slug ?? ""}"?`}
        description="This permanently removes the project and strips its slug from any skill or
        experience entry that references it. This cannot be undone."
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      <Dialog open={!!dupTarget} onOpenChange={(o) => !o && setDupTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
              <Input value={dupTitle} onChange={(e) => setDupTitle(e.target.value)} />
            </div>
            <div>
              <span className="block text-xs font-medium text-muted-foreground mb-1">Slug</span>
              <Input
                value={dupSlug}
                onChange={(e) => setDupSlug(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={!dupSlug.trim()}>
              Create copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
