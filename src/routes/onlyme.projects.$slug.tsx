/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getStaged, updateProjectSlug } from "@/lib/server-fns";
import { normalizeProject, normalizeSkillsPage } from "@/lib/cms-normalize";
import type { Project } from "@/content/site";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { PreviewPane } from "@/components/admin/cms/PreviewPane";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { Field, FormSection, InputField, SelectField } from "@/components/admin/cms/FormSection";
import { TagInput } from "@/components/admin/cms/TagInput";
import { SkillMultiSelect } from "@/components/admin/cms/SkillMultiSelect";
import { MediaField } from "@/components/admin/cms/MediaField";
import { MediaGallery } from "@/components/admin/cms/MediaGallery";
import { ProjectView } from "@/components/public/ProjectView";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/onlyme/projects/$slug")({
  component: ProjectEditor,
});

function ProjectEditor() {
  const slug = Route.useParams().slug;
  const navigate = useNavigate();

  const draft = useCmsDraft<Project>({
    table: "projects",
    slug,
    normalize: (raw) => normalizeProject(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [skills, setSkills] = React.useState<any[]>([]);
  const [newSlug, setNewSlug] = React.useState(slug);
  const [renaming, setRenaming] = React.useState(false);

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "pages", slug: "skills" } })
      .then((d: any) => {
        const page = normalizeSkillsPage(d.staged);
        setSkills(page.skills ?? []);
      })
      .catch(() => setSkills([]));
  }, []);

  React.useEffect(() => setNewSlug(slug), [slug]);

  if (draft.loading) {
    return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  }
  if (draft.error && !draft.data) {
    return (
      <div className="space-y-4">
        <Link to="/onlyme/projects" className="text-sm text-muted-foreground hover:underline">
          ← Projects
        </Link>
        <EmptyState title="Could not load project" description={draft.error} />
      </div>
    );
  }
  if (!draft.data) return null;

  const p = draft.doc;
  const patch = (partial: Record<string, unknown>) =>
    draft.patch((doc) => ({ ...doc, ...partial }) as Project);

  const skillOptions = skills.map((s) => ({
    id: s.id,
    name: s.name,
    categoryId: s.categoryId,
  }));

  async function handleRename() {
    if (!newSlug.trim() || newSlug === slug) return;
    setRenaming(true);
    try {
      await (updateProjectSlug as any)({ data: { oldSlug: slug, newSlug: newSlug.trim() } });
      toast.success(`Renamed to "${newSlug}" — references updated`);
      navigate({ to: "/onlyme/projects/$slug", params: { slug: newSlug } });
    } catch (err: any) {
      toast.error(err?.message ?? "Rename failed");
    } finally {
      setRenaming(false);
    }
  }

  const preview = <ProjectView project={p} skills={skills} />;

  const editor = (
    <div className="space-y-6">
      <FormSection title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <InputField
              value={p.title}
              onChange={(e) => patch({ title: e.target.value })}
              data-testid="project-title"
            />
          </Field>
          <Field label="Year">
            <InputField value={p.year} onChange={(e) => patch({ year: e.target.value })} />
          </Field>
        </div>
        <Field label="Dek (subtitle)">
          <InputField value={p.dek} onChange={(e) => patch({ dek: e.target.value })} />
        </Field>
        <Field label="Summary" hint="Shown on the project page above the cover image.">
          <textarea
            value={p.summary ?? ""}
            onChange={(e) => patch({ summary: e.target.value })}
            rows={2}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Category">
            <InputField value={p.category} onChange={(e) => patch({ category: e.target.value })} />
          </Field>
          <Field label="Duration">
            <InputField
              value={p.duration ?? ""}
              onChange={(e) => patch({ duration: e.target.value })}
              placeholder="e.g. 3 months"
            />
          </Field>
          <Field label="Role">
            <InputField
              value={p.role ?? ""}
              onChange={(e) => patch({ role: e.target.value })}
              placeholder="e.g. Lead AI Engineer"
            />
          </Field>
        </div>
        <Field label="Stack" hint="Press Enter to add.">
          <TagInput
            value={p.stack ?? []}
            onChange={(stack) => patch({ stack })}
            placeholder="TypeScript…"
          />
        </Field>
      </FormSection>

      <FormSection title="Status & ordering">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="Status"
            value={p.status ?? "completed"}
            onValueChange={(status) => patch({ status: status as Project["status"] })}
            options={[
              { label: "Completed", value: "completed" },
              { label: "In progress", value: "in-progress" },
              { label: "Upcoming", value: "upcoming" },
              { label: "Archived", value: "archived" },
            ]}
          />
          <Field label="Priority">
            <InputField
              type="number"
              min={0}
              value={String(p.priority ?? 0)}
              onChange={(e) => patch({ priority: Number(e.target.value) || 0 })}
            />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(p.featured)}
                onChange={(e) => patch({ featured: e.target.checked })}
                className="size-4 cursor-pointer"
                data-testid="project-featured"
              />
              Featured (shown first on home)
            </label>
          </div>
        </div>
      </FormSection>

      <FormSection title="Media">
        <MediaField
          label="Thumbnail"
          value={p.thumbnail}
          onChange={(thumbnail) => patch({ thumbnail })}
          accept="image"
        />
        <MediaField
          label="Cover"
          value={p.cover}
          onChange={(cover) => patch({ cover })}
          accept="image"
        />
        <MediaGallery items={p.gallery ?? []} onChange={(gallery) => patch({ gallery })} />
      </FormSection>

      <FormSection title="Highlights">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Achievements" hint="One per line.">
            <textarea
              value={(p.achievements ?? []).join("\n")}
              onChange={(e) =>
                patch({
                  achievements: e.target.value.split("\n").map((s) => s.trimStart()),
                })
              }
              rows={4}
              placeholder="Reduced hallucination rate by 40%"
              className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
            />
          </Field>
          <div className="space-y-4">
            <Field label="Challenges">
              <textarea
                value={p.challenges ?? ""}
                onChange={(e) => patch({ challenges: e.target.value })}
                rows={4}
                className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
              />
            </Field>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Links"
        description="Live demo, GitHub, docs, papers — anything worth linking from the project page."
      >
        {(p.links ?? []).map((link: any, i: number) => (
          <div
            key={link.id ?? i}
            className="grid gap-3 border border-border p-3 md:grid-cols-[8rem_1fr_10rem_auto]"
          >
            <InputField
              value={link.label ?? ""}
              placeholder="Label"
              onChange={(e) => {
                const links: any[] = [...(p.links ?? [])];
                links[i] = { ...links[i], label: e.target.value };
                patch({ links });
              }}
            />
            <InputField
              value={link.href ?? ""}
              placeholder="https://…"
              onChange={(e) => {
                const links: any[] = [...(p.links ?? [])];
                links[i] = { ...links[i], href: e.target.value };
                patch({ links });
              }}
            />
            <SelectField
              value={link.kind ?? "other"}
              onValueChange={(kind) => {
                const links: any[] = [...(p.links ?? [])];
                links[i] = { ...links[i], kind };
                patch({ links });
              }}
              options={[
                { label: "Live", value: "live" },
                { label: "GitHub", value: "github" },
                { label: "Docs", value: "docs" },
                { label: "Demo", value: "demo" },
                { label: "Other", value: "other" },
              ]}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Remove link"
              onClick={() => patch({ links: (p.links ?? []).filter((_, ix) => ix !== i) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          data-testid="add-link"
          onClick={() =>
            patch({
              links: [
                ...(p.links ?? []),
                {
                  id: `link-${Date.now().toString(36)}`,
                  label: "",
                  href: "",
                  kind: "live" as const,
                },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add link
        </Button>
      </FormSection>

      <FormSection title="Related skills" description="Shown as chips on the project page.">
        <SkillMultiSelect
          skills={skillOptions}
          value={p.skillIds ?? []}
          onChange={(skillIds) => patch({ skillIds })}
        />
      </FormSection>

      <FormSection title="Description (blocks)" description="Long-form content below the summary.">
        <BlockEditor
          blocks={p.blocks}
          onChange={(blocks) => patch({ blocks: blocks as Project["blocks"] })}
        />
      </FormSection>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/onlyme/projects" className="text-sm text-muted-foreground hover:underline">
            ← Projects
          </Link>
          <h2 className="text-lg font-medium text-foreground">{p.title || slug}</h2>
          {draft.data.isPublic ? (
            <Badge variant="secondary" className="text-[0.65rem]">
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[0.65rem]">
              Draft
            </Badge>
          )}
        </div>
        <Link
          to="/projects/$slug"
          params={{ slug }}
          target="_blank"
          className="text-sm text-muted-foreground hover:underline"
        >
          View public page ↗
        </Link>
      </div>

      <div className="flex items-end gap-2 border border-border rounded-lg p-4 bg-muted/30">
        <Field label="Slug (URL)" className="flex-1">
          <InputField
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Button
          variant="outline"
          onClick={handleRename}
          disabled={renaming || newSlug === slug || !newSlug.trim()}
        >
          {renaming ? "Renaming…" : "Rename"}
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

      <PreviewPane
        mode="editor"
        onModeChange={() => {}}
        renderEditor={() => editor}
        renderPreview={() => preview}
      />
    </div>
  );
}
