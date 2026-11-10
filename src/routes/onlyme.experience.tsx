/* eslint-disable @typescript-eslint/no-explicit-any */
// Experience admin: draggable timeline rows + drawer editor per entry.
//
// Public /experience sorts by kind "experience" descending sort, so the admin
// list is displayed and revalidated in the same order (highest sort first).

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, listStaged } from "@/lib/server-fns";
import { normalizeExperiencePage, nextSort } from "@/lib/cms-normalize";
import type {
  ExperienceEntry,
  ExperiencePageContent,
  ExperienceEmploymentType,
  ExperienceWorkMode,
  ProjectLink,
} from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { ConfirmDialog } from "@/components/admin/cms/ConfirmDialog";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { Field, FormSection, InputField } from "@/components/admin/cms/FormSection";
import { DateField } from "@/components/admin/cms/DateField";
import { MediaField } from "@/components/admin/cms/MediaField";
import { MediaGallery } from "@/components/admin/cms/MediaGallery";
import { TagInput } from "@/components/admin/cms/TagInput";
import { SkillMultiSelect, type SkillOption } from "@/components/admin/cms/SkillMultiSelect";
import { SortableList } from "@/components/admin/cms/SortableList";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { ExperienceView } from "@/components/public/ExperienceView";
import { Plus, Search, Trash2, GripVertical } from "lucide-react";

export const Route = createFileRoute("/onlyme/experience")({
  component: ExperienceAdmin,
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** exactOptionalPropertyTypes-safe key set/delete helper. */
function withKey<T extends object>(obj: T, key: string, value: unknown): T {
  const next: any = { ...obj };
  if (value === undefined || value === null || value === "") delete next[key];
  else next[key] = value;
  return next;
}

function ExperienceAdmin() {
  const draft = useCmsDraft<ExperiencePageContent>({
    table: "pages",
    slug: "experience",
    normalize: (raw) => normalizeExperiencePage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [skills, setSkills] = React.useState<SkillOption[]>([]);
  const [projects, setProjects] = React.useState<{ slug: string; title: string }[]>([]);
  const [query, setQuery] = React.useState("");
  const [editingDraft, setEditingDraft] = React.useState<ExperienceEntry | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null); // null = new
  const [deleteTarget, setDeleteTarget] = React.useState<ExperienceEntry | null>(null);

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "pages", slug: "skills" } })
      .then((d: any) => {
        const content = d.staged ?? {};
        const cats = Array.isArray(content.categories) ? content.categories : [];
        const rows = Array.isArray(content.skills) ? content.skills : [];
        setSkills(
          rows.map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? s.id),
            categoryId: s.categoryId ? String(s.categoryId) : undefined,
            category: cats.find((c: any) => c.id === s.categoryId)?.name,
          })),
        );
      })
      .catch(() => setSkills([]));
    (listStaged as any)({ data: { table: "projects" } })
      .then((rows: any[]) =>
        setProjects(rows.map((r) => ({ slug: r.slug, title: r?.published?.title ?? r.slug }))),
      )
      .catch(() => setProjects([]));
  }, []);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (!draft.data) return null;

  const entries = draft.doc.entries ?? [];

  const patchDoc = (partial: Record<string, unknown>) =>
    draft.patch((d) => ({ ...d, ...partial }) as ExperiencePageContent);

  const setEntries = (next: ExperienceEntry[]) => patchDoc({ entries: next });

  // ---- filtering ----
  const filtered = entries.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.role.toLowerCase().includes(q) ||
      e.org.toLowerCase().includes(q) ||
      (e.overview ?? "").toLowerCase().includes(q) ||
      (e.tech ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });
  const searching = query !== "";
  const sortedDesc = [...entries].sort((a, b) => Number(b.sort ?? 0) - Number(a.sort ?? 0));

  // ---- CRUD ----
  const openNew = () => {
    setEditingId(null);
    setEditingDraft({
      id: `exp-new-${Date.now().toString(36)}`,
      role: "",
      org: "",
      visible: true,
      sort: nextSort(entries),
      current: false,
    });
  };

  const dateOrderError = (() => {
    const e = editingDraft;
    if (e?.current && e.endDate) return "A current role cannot have an end date";
    if (!e?.current && e?.startDate && e.endDate && e.endDate < e.startDate)
      return "End date must not be earlier than the start date";
    return null;
  })();

  const saveEntry = () => {
    if (!editingDraft) return;
    if (!editingDraft.role.trim()) {
      toast.error("Role is required");
      return;
    }
    if (!editingDraft.org.trim()) {
      toast.error("Organisation is required");
      return;
    }
    if (dateOrderError) {
      toast.error(dateOrderError);
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? entries.map((e) => (e.id === editingId ? editingDraft : e))
      : [...entries, editingDraft];
    setEntries(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Entry updated" : "Entry added — autosaved to draft");
  };

  const removeEntry = (entry: ExperienceEntry) => {
    setEntries(entries.filter((e) => e.id !== entry.id));
    toast.success(`Deleted "${entry.role} at ${entry.org}" from the draft`);
  };

  const duplicate = (entry: ExperienceEntry) => {
    const copy: ExperienceEntry = {
      ...entry,
      id: `exp-copy-${Date.now().toString(36)}`,
      role: `${entry.role} (copy)`,
      sort: nextSort(entries),
    };
    setEntries([...entries, copy]);
    toast.success("Duplicated into the draft");
  };

  const whenLabel = (e: ExperienceEntry) => {
    if (e.period && !e.startDate) return e.period;
    const from = e.startDate && DATE.test(e.startDate) ? e.startDate.slice(0, 4) : "";
    const to = e.current
      ? "Present"
      : e.endDate && DATE.test(e.endDate)
        ? e.endDate.slice(0, 4)
        : "";
    if (!from && !to) return e.period ?? "—";
    return `${from || "?"} — ${to}`;
  };

  const entryBadges = (e: ExperienceEntry) => (
    <>
      {e.current && (
        <Badge variant="secondary" className="text-[0.65rem]">
          Current
        </Badge>
      )}
      {e.employmentType && (
        <Badge variant="outline" className="text-[0.65rem]">
          {e.employmentType}
        </Badge>
      )}
      {e.workMode && (
        <Badge variant="outline" className="text-[0.65rem]">
          {e.workMode}
        </Badge>
      )}
      {e.visible === false && (
        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
          hidden
        </Badge>
      )}
    </>
  );

  const actionButtons = (e: ExperienceEntry) => (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          setEditingId(e.id);
          setEditingDraft({ ...e });
        }}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() =>
          setEntries(
            entries.map((x) => (x.id === e.id ? { ...x, visible: x.visible === false } : x)),
          )
        }
      >
        {e.visible === false ? "Show" : "Hide"}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => duplicate(e)}>
        Dup.
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive"
        onClick={() => setDeleteTarget(e)}
      >
        Del.
      </Button>
    </div>
  );

  // ---- drawer editor ----
  const editor = (
    <FormSection title={editingId ? "Edit entry" : "New entry"} className="border-0 p-0">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Role">
          <InputField
            value={editingDraft?.role ?? ""}
            onChange={(e) => setEditingDraft((d) => (d ? { ...d, role: e.target.value } : d))}
            data-testid="experience-role"
          />
        </Field>
        <Field label="Organisation">
          <InputField
            value={editingDraft?.org ?? ""}
            onChange={(e) => setEditingDraft((d) => (d ? { ...d, org: e.target.value } : d))}
            data-testid="experience-org"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Employment type">
          <select
            className="w-full border border-input bg-background px-3 py-2 text-sm"
            value={editingDraft?.employmentType ?? "__none__"}
            onChange={(e) =>
              setEditingDraft((d) =>
                d
                  ? withKey(
                      d,
                      "employmentType",
                      e.target.value === "__none__" ? "" : e.target.value,
                    )
                  : d,
              )
            }
          >
            <option value="__none__">—</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="freelance">Freelance</option>
            <option value="internship">Internship</option>
          </select>
        </Field>
        <Field label="Work mode">
          <select
            className="w-full border border-input bg-background px-3 py-2 text-sm"
            value={editingDraft?.workMode ?? "__none__"}
            onChange={(e) =>
              setEditingDraft((d) =>
                d ? withKey(d, "workMode", e.target.value === "__none__" ? "" : e.target.value) : d,
              )
            }
          >
            <option value="__none__">—</option>
            <option value="on-site">On-site</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Location">
          <InputField
            value={editingDraft?.location ?? ""}
            placeholder="Berlin, DE"
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "location", e.target.value) : d))
            }
          />
        </Field>
        <Field label="Company website">
          <div className="flex gap-2">
            <InputField
              value={editingDraft?.website ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                setEditingDraft((d) => (d ? withKey(d, "website", e.target.value) : d))
              }
            />
            <Button
              variant="outline"
              disabled={!editingDraft?.website}
              onClick={() => window.open(editingDraft?.website, "_blank")}
            >
              Test
            </Button>
          </div>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          label="Start date"
          value={editingDraft?.startDate}
          onChange={(startDate) =>
            setEditingDraft((d) => (d ? withKey(d, "startDate", startDate) : d))
          }
        />
        {editingDraft?.current ? null : (
          <DateField
            label="End date"
            value={editingDraft?.endDate}
            onChange={(endDate) => setEditingDraft((d) => (d ? withKey(d, "endDate", endDate) : d))}
          />
        )}
        <div className="flex items-center gap-6 pb-1 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer"
              data-testid="experience-current"
              checked={Boolean(editingDraft?.current)}
              onChange={(e) =>
                setEditingDraft((d) => {
                  if (!d) return d;
                  if (e.target.checked) {
                    const next: any = { ...d, current: true };
                    delete next.endDate;
                    return next;
                  }
                  return { ...d, current: false };
                })
              }
            />
            Current role (shows “Present” instead of an end date)
          </label>
        </div>
        {dateOrderError && (
          <p className="text-xs text-destructive md:col-span-2">{dateOrderError}</p>
        )}
      </div>
      <Field label="Overview">
        <textarea
          rows={3}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={editingDraft?.overview ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, overview: e.target.value } : d))}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Responsibilities" hint="One per line.">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
            value={(editingDraft?.responsibilities ?? []).join("\n")}
            onChange={(e) =>
              setEditingDraft((d) =>
                d
                  ? withKey(
                      d,
                      "responsibilities",
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean).length
                        ? e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : undefined,
                    )
                  : d,
              )
            }
          />
        </Field>
        <Field label="Achievements" hint="One per line.">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
            value={(editingDraft?.achievements ?? []).join("\n")}
            onChange={(e) =>
              setEditingDraft((d) =>
                d
                  ? withKey(
                      d,
                      "achievements",
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean).length
                        ? e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : undefined,
                    )
                  : d,
              )
            }
          />
        </Field>
      </div>
      <Field label="Tech stack" hint="Press Enter to add.">
        <TagInput
          value={editingDraft?.tech ?? []}
          onChange={(tech) =>
            setEditingDraft((d) => (d ? withKey(d, "tech", tech.length ? tech : undefined) : d))
          }
          placeholder="TypeScript…"
        />
      </Field>
      <Field label="Related skills">
        <SkillMultiSelect
          skills={skills}
          value={editingDraft?.skillIds ?? []}
          onChange={(skillIds) =>
            setEditingDraft((d) =>
              d ? withKey(d, "skillIds", skillIds.length ? skillIds : undefined) : d,
            )
          }
        />
      </Field>
      <Field label="Related projects" hint="Cross-referenced on the project pages too.">
        <div className="space-y-1">
          {projects.map((pr) => {
            const checked = (editingDraft?.projectSlugs ?? []).includes(pr.slug);
            return (
              <label key={pr.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  checked={checked}
                  onChange={() =>
                    setEditingDraft((d) => {
                      if (!d) return d;
                      const has = (d.projectSlugs ?? []).includes(pr.slug);
                      const next = has
                        ? (d.projectSlugs ?? []).filter((s) => s !== pr.slug)
                        : [...(d.projectSlugs ?? []), pr.slug];
                      return withKey(d, "projectSlugs", next.length ? next : undefined);
                    })
                  }
                />
                {pr.title}
              </label>
            );
          })}
          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground">No projects yet.</p>
          )}
        </div>
      </Field>
      <MediaField
        label="Logo"
        value={editingDraft?.logo}
        onChange={(logo) =>
          setEditingDraft((d) => (d ? withKey(d, "logo", logo.src ? logo : undefined) : d))
        }
        accept="image"
      />
      <MediaGallery
        items={editingDraft?.media ?? []}
        onChange={(media) =>
          setEditingDraft((d) => (d ? withKey(d, "media", media.length ? media : undefined) : d))
        }
      />
      <Field label="Links" hint="Repos, announcements, press — optional.">
        {(editingDraft?.links ?? []).map((link: ProjectLink, i: number) => (
          <div
            key={link.id ?? i}
            className="grid gap-2 border border-border p-2 md:grid-cols-[8rem_1fr_auto]"
          >
            <InputField
              value={link.label ?? ""}
              placeholder="Label"
              onChange={(e) => {
                const links = [...(editingDraft?.links ?? [])];
                links[i] = { ...links[i]!, label: e.target.value };
                setEditingDraft((d) => (d ? withKey(d, "links", links) : d));
              }}
            />
            <InputField
              value={link.href ?? ""}
              placeholder="https://…"
              onChange={(e) => {
                const links = [...(editingDraft?.links ?? [])];
                links[i] = { ...links[i]!, href: e.target.value };
                setEditingDraft((d) => (d ? withKey(d, "links", links) : d));
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Remove link"
              onClick={() => {
                const links = (editingDraft?.links ?? []).filter((_, ix) => ix !== i);
                setEditingDraft((d) =>
                  d ? withKey(d, "links", links.length ? links : undefined) : d,
                );
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setEditingDraft((d) => {
              if (!d) return d;
              const links: ProjectLink[] = [
                ...(d.links ?? []),
                { id: `elink-${Date.now().toString(36)}`, label: "", href: "", kind: "other" },
              ];
              return withKey(d, "links", links);
            })
          }
        >
          <Plus className="size-4" /> Add link
        </Button>
      </Field>
      <Field label="Description blocks" hint="Optional long-form content for this entry.">
        <div data-testid="experience-blocks">
          <BlockEditor
            blocks={editingDraft?.blocks ?? []}
            onChange={(blocks) =>
              setEditingDraft((d) =>
                d ? withKey(d, "blocks", blocks.length ? blocks : undefined) : d,
              )
            }
          />
        </div>
      </Field>
      <div className="flex gap-2">
        <Button data-testid="experience-save" onClick={saveEntry} disabled={!!dateOrderError}>
          {editingId ? "Apply changes" : "Add entry"}
        </Button>
        <Button variant="outline" onClick={() => setEditingDraft(null)}>
          Cancel
        </Button>
      </div>
    </FormSection>
  );

  const preview = (
    <div className="max-w-3xl mx-auto py-6">
      <ExperienceView content={draft.doc} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Experience</h2>
          <span className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Button data-testid="add-experience" onClick={openNew}>
          <Plus className="size-4" /> New entry
        </Button>
      </div>

      <SaveBar
        dirty={draft.dirty}
        loading={draft.loading}
        saving={draft.saving}
        hasPublished={draft.data.isPublic}
        lastSaved={draft.lastSaved}
        error={draft.error}
        onSave={() => draft.save()}
        onPublish={() => draft.publish()}
        onRevert={() =>
          window.confirm("Discard staged changes and restore the published version?") &&
          draft.revert()
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search role, org, tech…"
          className="pl-8"
          data-testid="experience-search"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No experience entries yet"
          description="Add your first role — the public timeline follows this order, newest first."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> New entry
            </Button>
          }
        />
      ) : searching ? (
        <div className="border border-border" data-testid="experience-list">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No entries match this search.
            </div>
          )}
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
              data-testid="experience-row"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-foreground">{e.role || "(untitled)"}</span>
                  <span className="text-xs text-muted-foreground">{e.org}</span>
                  {entryBadges(e)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{whenLabel(e)}</div>
              </div>
              {actionButtons(e)}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border" data-testid="experience-list">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Drag to reorder — the top row shows first on /experience
          </div>
          <SortableList
            items={sortedDesc}
            getId={(e) => e.id}
            onReorder={(next) =>
              setEntries(next.map((e, i) => ({ ...e, sort: next.length - 1 - i })))
            }
            renderItem={(e, { index, moveUp, moveDown }: any) => (
              <div
                className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
                data-testid="experience-row"
              >
                <div className="flex flex-col items-center">
                  <span className="cursor-grab text-muted-foreground" aria-label="Drag to reorder">
                    <GripVertical className="size-4" />
                  </span>
                  <div className="mt-1 flex">
                    <button
                      onClick={moveUp}
                      disabled={index === 0}
                      className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={moveDown}
                      disabled={index === sortedDesc.length - 1}
                      className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-foreground">{e.role || "(untitled)"}</span>
                    <span className="text-xs text-muted-foreground">{e.org}</span>
                    {entryBadges(e)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{whenLabel(e)}</div>
                </div>
                {actionButtons(e)}
              </div>
            )}
          />
        </div>
      )}

      {/* Drawer editor */}
      <Sheet open={!!editingDraft} onOpenChange={(o) => !o && setEditingDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit entry" : "New entry"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{editor}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.role ?? ""} at ${deleteTarget?.org ?? ""}"?`}
        description="Removes the entry from the draft (and from the site once you publish). References from projects are cleaned up automatically."
        onConfirm={() => {
          if (deleteTarget) removeEntry(deleteTarget);
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
