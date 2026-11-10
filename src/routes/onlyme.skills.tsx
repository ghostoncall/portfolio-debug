/* eslint-disable @typescript-eslint/no-explicit-any */
// Skills admin: categories (draggable, visible/hidden) + skills table with
// drawer editor, search/filter, bulk operations and project associations.
//
// One autosaved draft covers the whole document (categories + skills).
// Publish copies staged → published in one atomic write.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { listStaged } from "@/lib/server-fns";
import { normalizeSkillsPage, nextSort, stableId } from "@/lib/cms-normalize";
import type { Skill, SkillCategory, SkillsPageContent } from "@/content/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { ConfirmDialog } from "@/components/admin/cms/ConfirmDialog";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { Field, FormSection, InputField, SelectField } from "@/components/admin/cms/FormSection";
import { SortableList } from "@/components/admin/cms/SortableList";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/onlyme/skills")({
  component: SkillsAdmin,
});

const LEVEL_OPTIONS = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
  { label: "Expert", value: "expert" },
];

function SkillsAdmin() {
  const draft = useCmsDraft<SkillsPageContent>({
    table: "pages",
    slug: "skills",
    normalize: (raw) => normalizeSkillsPage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [projects, setProjects] = React.useState<{ slug: string; title: string }[]>([]);
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editingDraft, setEditingDraft] = React.useState<Skill | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null); // null = new
  const [deleteSkill, setDeleteSkill] = React.useState<Skill | null>(null);
  const [deleteCategory, setDeleteCategory] = React.useState<SkillCategory | null>(null);

  React.useEffect(() => {
    (listStaged as any)({ data: { table: "projects" } })
      .then((rows: any[]) =>
        setProjects(rows.map((r) => ({ slug: r.slug, title: r?.published?.title ?? r.slug }))),
      )
      .catch(() => setProjects([]));
  }, []);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (!draft.data) return null;

  const doc = draft.doc;
  const categories = doc.categories ?? [];
  const skills = doc.skills ?? [];

  const patchDoc = (partial: Record<string, unknown>) =>
    draft.patch((d) => ({ ...d, ...partial }) as SkillsPageContent);

  const setSkills = (next: Skill[]) => patchDoc({ skills: next });
  const setCategories = (next: SkillCategory[]) => patchDoc({ categories: next });

  const patchSkill = (id: string, partial: Partial<Skill>) =>
    setSkills(skills.map((s) => (s.id === id ? { ...s, ...partial } : s)));

  // ---- filtering ----
  const filtered = skills.filter((s) => {
    if (categoryFilter !== "all" && s.categoryId !== categoryFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.detail ?? "").toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q)
    );
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((s) => s.id)));

  // ---- CRUD ----
  const openNew = () => {
    const firstCat = categories[0];
    if (!firstCat) {
      toast.error("Create a category first");
      return;
    }
    setEditingId(null);
    setEditingDraft({
      id: stableId("skill", `new-skill-${Date.now().toString(36)}`),
      name: "",
      categoryId: firstCat.id,
      detail: "",
      level: "intermediate",
      visible: true,
      featured: false,
      projectSlugs: [],
      sort: nextSort(skills),
    });
  };

  const saveSkill = () => {
    if (!editingDraft) return;
    if (!editingDraft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? skills.map((s) => (s.id === editingId ? editingDraft : s))
      : [...skills, { ...editingDraft, sort: nextSort(skills) }];
    // Renaming a skill keeps a deterministic id only for new rows; existing ids are stable.
    setSkills(next as Skill[]);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Skill updated" : "Skill added — autosaved to draft");
  };

  const removeSkill = (skill: Skill) => {
    setSkills(skills.filter((s) => s.id !== skill.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(skill.id);
      return next;
    });
    toast.success(`Deleted "${skill.name}" from the draft`);
  };

  // ---- bulk ----
  const bulkCategory = (categoryId: string) => {
    setSkills(skills.map((s) => (selected.has(s.id) ? { ...s, categoryId } : s)));
    toast.success(`Moved ${selected.size} skill(s)`);
    setSelected(new Set());
  };
  const bulkVisible = (visible: boolean) => {
    setSkills(skills.map((s) => (selected.has(s.id) ? { ...s, visible } : s)));
    setSelected(new Set());
  };
  const bulkDelete = () => {
    setSkills(skills.filter((s) => !selected.has(s.id)));
    toast.success(`Deleted ${selected.size} skill(s)`);
    setSelected(new Set());
  };

  // ---- categories ----
  const addCategory = () => {
    const name = window.prompt("Category name");
    if (!name?.trim()) return;
    setCategories([
      ...categories,
      {
        id: stableId("cat", name.trim()),
        name: name.trim(),
        sort: nextSort(categories),
        visible: true,
      },
    ]);
  };

  const renameCategory = (cat: SkillCategory) => {
    const name = window.prompt("Rename category", cat.name);
    if (!name?.trim() || name.trim() === cat.name) return;
    setCategories(categories.map((c) => (c.id === cat.id ? { ...c, name: name.trim() } : c)));
  };

  const removeCategory = (cat: SkillCategory) => {
    const hasSkills = skills.some((s) => s.categoryId === cat.id);
    if (hasSkills) {
      toast.error("Move or delete its skills first — the category is not empty");
      setDeleteCategory(null);
      return;
    }
    setCategories(categories.filter((c) => c.id !== cat.id));
    if (categoryFilter === cat.id) setCategoryFilter("all");
    toast.success(`Deleted category "${cat.name}"`);
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const editor = (
    <FormSection title={editingId ? "Edit skill" : "New skill"} className="border-0 p-0">
      <Field label="Name">
        <InputField
          value={editingDraft?.name ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, name: e.target.value } : d))}
          data-testid="skill-name"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Category"
          value={editingDraft?.categoryId ?? ""}
          onValueChange={(categoryId) => setEditingDraft((d) => (d ? { ...d, categoryId } : d))}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <SelectField
          label="Level"
          value={editingDraft?.level ?? "intermediate"}
          onValueChange={(level) => setEditingDraft((d) => (d ? ({ ...d, level } as Skill) : d))}
          options={LEVEL_OPTIONS}
        />
        <Field label="Years of experience">
          <InputField
            type="number"
            min={0}
            value={editingDraft?.years != null ? String(editingDraft.years) : ""}
            onChange={(e) => {
              const v = e.target.value;
              setEditingDraft((d) => {
                if (!d) return d;
                if (v === "") {
                  const next: Skill = { ...d };
                  delete next.years;
                  return next;
                }
                return { ...d, years: Number(v) };
              });
            }}
          />
        </Field>
        <div className="flex items-end gap-6 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer"
              checked={Boolean(editingDraft?.visible)}
              onChange={(e) =>
                setEditingDraft((d) => (d ? { ...d, visible: e.target.checked } : d))
              }
            />
            Visible on site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer"
              checked={Boolean(editingDraft?.featured)}
              onChange={(e) =>
                setEditingDraft((d) => (d ? { ...d, featured: e.target.checked } : d))
              }
            />
            Featured
          </label>
        </div>
      </div>
      <Field label="Short detail" hint="Shown in the table column on /skills.">
        <InputField
          value={editingDraft?.detail ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, detail: e.target.value } : d))}
          data-testid="skill-detail"
        />
      </Field>
      <Field label="Full description" hint="Optional longer paragraph.">
        <textarea
          rows={3}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={editingDraft?.description ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, description: e.target.value } : d))}
        />
      </Field>
      <Field label="Related projects" hint="Show this skill on the selected project pages.">
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
                      return {
                        ...d,
                        projectSlugs: has
                          ? (d.projectSlugs ?? []).filter((s) => s !== pr.slug)
                          : [...(d.projectSlugs ?? []), pr.slug],
                      };
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
      <div className="flex gap-2">
        <Button onClick={saveSkill}>{editingId ? "Apply changes" : "Add skill"}</Button>
        <Button variant="outline" onClick={() => setEditingDraft(null)}>
          Cancel
        </Button>
      </div>
    </FormSection>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Skills</h2>
          <span className="text-xs text-muted-foreground">
            {skills.length} skills · {categories.length} categories
          </span>
        </div>
        <Button data-testid="add-skill" onClick={openNew}>
          <Plus className="size-4" /> New skill
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

      {/* Categories */}
      <FormSection
        title="Categories"
        description="Drag to reorder. A category shows on /skills only when it has visible skills."
      >
        <div className="space-y-2">
          <SortableList
            items={categories}
            getId={(c) => c.id}
            onReorder={(next) => setCategories(next.map((c, i) => ({ ...c, sort: i })))}
            renderItem={(cat, { index, moveUp, moveDown }: any) => (
              <div
                className="flex items-center gap-3 border border-border px-3 py-2 bg-background"
                data-testid="skill-category-row"
              >
                <span className="cursor-grab text-muted-foreground">
                  <GripVertical className="size-4" />
                </span>
                <div className="flex flex-col">
                  <button
                    onClick={moveUp}
                    disabled={index === 0}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                </div>
                <span className="font-serif text-foreground">{cat.name}</span>
                <span className="text-xs text-muted-foreground">
                  {skills.filter((s) => s.categoryId === cat.id).length} skills
                </span>
                <label className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 cursor-pointer"
                    checked={cat.visible !== false}
                    onChange={(e) =>
                      setCategories(
                        categories.map((c) =>
                          c.id === cat.id ? { ...c, visible: e.target.checked } : c,
                        ),
                      )
                    }
                  />
                  visible
                </label>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => renameCategory(cat)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive"
                    onClick={() => setDeleteCategory(cat)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          />
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="size-4" /> Add category
          </Button>
        </div>
      </FormSection>

      {/* Search + filter + bulk bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="pl-8"
            data-testid="skill-search"
          />
        </div>
        <SelectField
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          options={[
            { label: "All categories", value: "all" },
            ...categories.map((c) => ({ label: c.name, value: c.id })),
          ]}
          className="w-48"
        />
      </div>

      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border border-border rounded-md bg-muted/40 px-3 py-2"
          data-testid="bulk-bar"
        >
          <span className="text-sm font-medium">{selected.size} selected</span>
          <SelectField
            testId="bulk-move-category"
            value="__move__"
            onValueChange={(v) => {
              if (v !== "__move__") bulkCategory(v);
            }}
            options={[
              { label: "Move to category…", value: "__move__" },
              ...categories.map((c) => ({ label: c.name, value: c.id })),
            ]}
            className="w-52"
          />
          <Button variant="outline" size="sm" onClick={() => bulkVisible(true)}>
            Show
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkVisible(false)}>
            Hide
          </Button>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Skills table */}
      {skills.length === 0 ? (
        <EmptyState
          title="No skills yet"
          description="Add your first skill — group them with categories."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> New skill
            </Button>
          }
        />
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Name
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Category
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Level
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Years
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Projects
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Flags
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody data-testid="skills-table">
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                      aria-label={`Select ${s.name}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-serif text-foreground">
                    {s.name}
                    {s.detail && (
                      <span className="block text-xs text-muted-foreground">{s.detail}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{catName(s.categoryId)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.level ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.years ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.projectSlugs?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!s.visible && (
                        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                          hidden
                        </Badge>
                      )}
                      {s.featured && (
                        <Badge variant="secondary" className="text-[0.65rem]">
                          featured
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setEditingId(s.id);
                          setEditingDraft({ ...s });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          patchSkill(s.id, { visible: s.visible === false ? true : false })
                        }
                      >
                        {s.visible === false ? "Show" : "Hide"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const copy: Skill = {
                            ...s,
                            id: stableId("skill", `${s.name}-copy-${Date.now().toString(36)}`),
                            name: `${s.name} (copy)`,
                            sort: nextSort(skills),
                          };
                          setSkills([...skills, copy]);
                          toast.success("Copied");
                        }}
                      >
                        Dup.
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive"
                        onClick={() => setDeleteSkill(s)}
                      >
                        Del.
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No skills match this search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer editor */}
      <Sheet open={!!editingDraft} onOpenChange={(o) => !o && setEditingDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit skill" : "New skill"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{editor}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteSkill}
        title={`Delete "${deleteSkill?.name ?? ""}"?`}
        description="Removes the skill from the draft (and from the site once you publish)."
        onConfirm={() => {
          if (deleteSkill) removeSkill(deleteSkill);
          setDeleteSkill(null);
        }}
        onClose={() => setDeleteSkill(null)}
      />

      <ConfirmDialog
        open={!!deleteCategory}
        title={`Delete category "${deleteCategory?.name ?? ""}"?`}
        description="Only empty categories can be deleted."
        onConfirm={() => {
          if (deleteCategory) removeCategory(deleteCategory);
          setDeleteCategory(null);
        }}
        onClose={() => setDeleteCategory(null)}
      />
    </div>
  );
}
