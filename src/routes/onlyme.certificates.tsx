/* eslint-disable @typescript-eslint/no-explicit-any */
// Certificates admin: filterable card list + drawer editor.
//
// The whole collection is one document (pages/certificates), so edits are
// autosaved to the staged draft; Publish makes the set live in one write.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, publishItem, revertItem } from "@/lib/server-fns";
import { normalizeCertificatesPage, nextSort, stableId } from "@/lib/cms-normalize";
import type { Certificate, CertificatesPageContent } from "@/content/site";
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
import { SkillMultiSelect, type SkillOption } from "@/components/admin/cms/SkillMultiSelect";
import { SortableList } from "@/components/admin/cms/SortableList";
import { CertificatesView } from "@/components/public/CertificatesView";
import { Media } from "@/components/media";
import { GripVertical, Plus, Search } from "lucide-react";
import { format, isPast, isBefore, parseISO, differenceInCalendarDays } from "date-fns";

export const Route = createFileRoute("/onlyme/certificates")({
  component: CertificatesAdmin,
});

function certStatus(c: Certificate): {
  label: string;
  tone: "expired" | "soon" | "valid" | "none";
} {
  if (!c.expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(c.expiryDate))
    return { label: "No expiry", tone: "none" };
  const expiry = parseISO(c.expiryDate);
  if (isPast(expiry)) return { label: "Expired", tone: "expired" };
  const days = differenceInCalendarDays(expiry, new Date());
  if (days <= 60) return { label: `Expires in ${days}d`, tone: "soon" };
  return { label: `Valid until ${format(expiry, "MMM yyyy")}`, tone: "valid" };
}

function CertificatesAdmin() {
  const draft = useCmsDraft<CertificatesPageContent>({
    table: "pages",
    slug: "certificates",
    normalize: (raw) => normalizeCertificatesPage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [skills, setSkills] = React.useState<SkillOption[]>([]);
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [featuredFilter, setFeaturedFilter] = React.useState<"all" | "featured" | "regular">("all");
  const [editingDraft, setEditingDraft] = React.useState<Certificate | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null); // null = new
  const [deleteTarget, setDeleteTarget] = React.useState<Certificate | null>(null);

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "pages", slug: "skills" } })
      .then((d: any) => {
        const page = normalizeSkillsLite(d.staged);
        setSkills(page);
      })
      .catch(() => setSkills([]));
  }, []);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (!draft.data) return null;

  const certs = draft.doc.certificates ?? [];

  const patchDoc = (partial: Record<string, unknown>) =>
    draft.patch((d) => ({ ...d, ...partial }) as CertificatesPageContent);

  const setCerts = (next: Certificate[]) => patchDoc({ certificates: next });

  // ---- filtering ----
  const categories = Array.from(
    new Set(certs.map((c) => c.category).filter((c): c is string => Boolean(c?.trim()))),
  );
  const filtered = certs.filter((c) => {
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    if (featuredFilter === "featured" && !c.featured) return false;
    if (featuredFilter === "regular" && c.featured) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.issuer.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      (c.credentialId ?? "").toLowerCase().includes(q)
    );
  });
  const filterActive = query !== "" || categoryFilter !== "all" || featuredFilter !== "all";

  // ---- CRUD ----
  const openNew = () => {
    setEditingId(null);
    setEditingDraft({
      id: stableId("cert", `new-cert-${Date.now().toString(36)}`),
      title: "",
      issuer: "",
      visible: true,
      featured: false,
      skillIds: [],
      sort: nextSort(certs),
    });
  };

  const dateOrderError = (() => {
    const e = editingDraft;
    if (!e?.issueDate || !e.expiryDate) return null;
    return isBefore(parseISO(e.expiryDate), parseISO(e.issueDate))
      ? "Expiry date must be on or after the issue date"
      : null;
  })();

  const saveCert = () => {
    if (!editingDraft) return;
    if (!editingDraft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!editingDraft.issuer.trim()) {
      toast.error("Issuer is required");
      return;
    }
    if (dateOrderError) {
      toast.error(dateOrderError);
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? certs.map((c) => (c.id === editingId ? editingDraft : c))
      : [...certs, { ...editingDraft, sort: nextSort(certs) }];
    setCerts(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Certificate updated" : "Certificate added — autosaved to draft");
  };

  const removeCert = (cert: Certificate) => {
    setCerts(certs.filter((c) => c.id !== cert.id));
    toast.success(`Deleted "${cert.title}" from the draft`);
  };

  const duplicate = (cert: Certificate) => {
    const copy: Certificate = {
      ...cert,
      id: stableId("cert", `${cert.title}-copy-${Date.now().toString(36)}`),
      title: `${cert.title} (copy)`,
      sort: nextSort(certs),
    };
    setCerts([...certs, copy]);
    toast.success("Duplicated into the draft");
  };

  const editor = (
    <FormSection
      title={editingId ? "Edit certificate" : "New certificate"}
      className="border-0 p-0"
    >
      <Field label="Title">
        <InputField
          value={editingDraft?.title ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, title: e.target.value } : d))}
          data-testid="certificate-title"
        />
      </Field>
      <Field label="Issuer">
        <InputField
          value={editingDraft?.issuer ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, issuer: e.target.value } : d))}
          data-testid="certificate-issuer"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          label="Issue date"
          value={editingDraft?.issueDate}
          onChange={(issueDate) =>
            setEditingDraft((d) => {
              if (!d) return d;
              const next: Certificate = { ...d };
              if (issueDate === undefined) delete next.issueDate;
              else next.issueDate = issueDate;
              return next;
            })
          }
        />
        <DateField
          label="Expiry date"
          value={editingDraft?.expiryDate}
          onChange={(expiryDate) =>
            setEditingDraft((d) => {
              if (!d) return d;
              const next: Certificate = { ...d };
              if (expiryDate === undefined) delete next.expiryDate;
              else next.expiryDate = expiryDate;
              return next;
            })
          }
          error={dateOrderError ?? undefined}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Credential ID">
          <InputField
            value={editingDraft?.credentialId ?? ""}
            onChange={(e) =>
              setEditingDraft((d) => (d ? { ...d, credentialId: e.target.value } : d))
            }
          />
        </Field>
        <Field label="Credential URL" hint="Verification link shown as “Verify credential”.">
          <div className="flex gap-2">
            <InputField
              value={editingDraft?.credentialUrl ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                setEditingDraft((d) => (d ? { ...d, credentialUrl: e.target.value } : d))
              }
            />
            <Button
              variant="outline"
              disabled={!editingDraft?.credentialUrl}
              onClick={() => window.open(editingDraft?.credentialUrl, "_blank")}
            >
              Test
            </Button>
          </div>
        </Field>
      </div>
      <Field label="Category" hint="Free text — existing categories are suggested.">
        <InputField
          list="certificate-categories"
          value={editingDraft?.category ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, category: e.target.value } : d))}
        />
        <datalist id="certificate-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={editingDraft?.description ?? ""}
          onChange={(e) => setEditingDraft((d) => (d ? { ...d, description: e.target.value } : d))}
        />
      </Field>
      <div className="flex items-center gap-6 pb-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            checked={Boolean(editingDraft?.visible)}
            onChange={(e) => setEditingDraft((d) => (d ? { ...d, visible: e.target.checked } : d))}
          />
          Visible on site
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            checked={Boolean(editingDraft?.featured)}
            onChange={(e) => setEditingDraft((d) => (d ? { ...d, featured: e.target.checked } : d))}
          />
          Featured
        </label>
      </div>
      <MediaField
        label="Image (badge, card artwork)"
        value={editingDraft?.image}
        onChange={(image) => setEditingDraft((d) => (d ? { ...d, image } : d))}
        accept="image"
      />
      <MediaField
        label="PDF file"
        value={editingDraft?.file}
        onChange={(file) => setEditingDraft((d) => (d ? { ...d, file } : d))}
        accept="pdf"
      />
      <Field label="Related skills" hint="Shown as chips with the certificate.">
        <SkillMultiSelect
          skills={skills}
          value={editingDraft?.skillIds ?? []}
          onChange={(skillIds) => setEditingDraft((d) => (d ? { ...d, skillIds } : d))}
        />
      </Field>
      <div className="flex gap-2">
        <Button data-testid="certificate-save" onClick={saveCert} disabled={!!dateOrderError}>
          {editingId ? "Apply changes" : "Add certificate"}
        </Button>
        <Button variant="outline" onClick={() => setEditingDraft(null)}>
          Cancel
        </Button>
      </div>
    </FormSection>
  );

  const actionButtons = (c: Certificate) => (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          const next = { ...c };
          setEditingId(c.id);
          setEditingDraft(next);
        }}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() =>
          setCerts(certs.map((x) => (x.id === c.id ? { ...x, visible: x.visible === false } : x)))
        }
      >
        {c.visible === false ? "Show" : "Hide"}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => duplicate(c)}>
        Dup.
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive"
        onClick={() => setDeleteTarget(c)}
      >
        Del.
      </Button>
    </div>
  );

  const certBadges = (c: Certificate) => {
    const status = certStatus(c);
    return (
      <>
        {c.category && (
          <Badge variant="outline" className="text-[0.65rem]">
            {c.category}
          </Badge>
        )}
        {c.featured && (
          <Badge variant="secondary" className="text-[0.65rem]">
            featured
          </Badge>
        )}
        {c.visible === false && (
          <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
            hidden
          </Badge>
        )}
        {status.tone === "expired" && (
          <Badge variant="destructive" className="text-[0.65rem]">
            {status.label}
          </Badge>
        )}
        {status.tone === "soon" && (
          <Badge variant="outline" className="text-[0.65rem] text-amber-600">
            {status.label}
          </Badge>
        )}
        {status.tone === "valid" && (
          <span className="text-[0.65rem] text-muted-foreground">{status.label}</span>
        )}
        {status.tone === "none" && (
          <span className="text-[0.65rem] text-muted-foreground">{status.label}</span>
        )}
      </>
    );
  };

  const thumb = (c: Certificate) => {
    const src = c.image?.src ?? c.file?.src;
    if (!src) return null;
    return (
      <div className="aspect-[4/3] w-16 overflow-hidden bg-muted rounded border border-border">
        <Media items={[{ src }]} />
      </div>
    );
  };

  const list = filterActive ? (
    <div className="border border-border" data-testid="certificate-list">
      {filtered.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
          data-testid="certificate-row"
        >
          {thumb(c)}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-foreground">{c.title || "(untitled)"}</span>
              {certBadges(c)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {c.issuer}
              {c.issueDate ? ` · issued ${c.issueDate}` : ""}
              {c.expiryDate ? ` · expires ${c.expiryDate}` : ""}
              {c.skillIds?.length ? ` · ${c.skillIds.length} skill(s)` : ""}
            </div>
          </div>
          {actionButtons(c)}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No certificates match these filters.
        </div>
      )}
    </div>
  ) : (
    <div className="border border-border" data-testid="certificate-list">
      <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
        Drag to reorder — /certificates follows this order
      </div>
      <SortableList
        items={certs}
        getId={(c) => c.id}
        onReorder={(next) => setItemsOrder(next)}
        renderItem={(c, { index, moveUp, moveDown }: any) => (
          <div
            className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
            data-testid="certificate-row"
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
                  disabled={index === certs.length - 1}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
            </div>
            {thumb(c)}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-foreground">{c.title || "(untitled)"}</span>
                {certBadges(c)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {c.issuer}
                {c.issueDate ? ` · issued ${c.issueDate}` : ""}
                {c.expiryDate ? ` · expires ${c.expiryDate}` : ""}
              </div>
            </div>
            {actionButtons(c)}
          </div>
        )}
      />
    </div>
  );

  function setItemsOrder(next: Certificate[]) {
    setCerts(next.map((c, i) => ({ ...c, sort: i })));
  }

  const preview = (
    <div className="max-w-3xl mx-auto py-6">
      <CertificatesView content={draft.doc} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Certificates</h2>
          <span className="text-xs text-muted-foreground">
            {certs.length} {certs.length === 1 ? "certificate" : "certificates"}
          </span>
        </div>
        <Button data-testid="add-certificate" onClick={openNew}>
          <Plus className="size-4" /> New certificate
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, issuer, credential…"
            className="pl-8"
            data-testid="certificate-search"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-input bg-background px-3 py-2 text-sm"
          data-testid="certificate-category-filter"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value as typeof featuredFilter)}
          className="border border-input bg-background px-3 py-2 text-sm"
          aria-label="Filter by featured"
        >
          <option value="all">All certificates</option>
          <option value="featured">Featured only</option>
          <option value="regular">Not featured</option>
        </select>
      </div>

      {certs.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Add your first certificate — image, PDF and verification link are all optional."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> New certificate
            </Button>
          }
        />
      ) : (
        list
      )}

      {/* Drawer editor */}
      <Sheet open={!!editingDraft} onOpenChange={(o) => !o && setEditingDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit certificate" : "New certificate"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{editor}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        description="Removes the certificate from the draft (and from the site once you publish)."
        onConfirm={() => {
          if (deleteTarget) removeCert(deleteTarget);
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// Lightweight skills fetch for the SkillMultiSelect options.
function normalizeSkillsLite(raw: unknown): SkillOption[] {
  const r = (raw as any) ?? {};
  const content = r.staged ?? r;
  const skills = Array.isArray(content?.skills) ? content.skills : [];
  const cats = Array.isArray(content?.categories) ? content.categories : [];
  return skills.map((s: any) => ({
    id: String(s.id),
    name: String(s.name ?? s.id),
    categoryId: s.categoryId ? String(s.categoryId) : undefined,
    category: cats.find((c: any) => c.id === s.categoryId)?.name,
  }));
}
