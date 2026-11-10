/* eslint-disable @typescript-eslint/no-explicit-any */
// Draft hook for CMS editors.
//
// Staged-draft lifecycle modeled on the proven blog editor:
//   patch()      → mark dirty, debounce autosave to `staged`
//   save()       → explicit write to `staged` (shows status)
//   publish()    → save() then publishItem (staged → published)
//   revert()     → restore staged from published
//
// All writes go to `staged` only; Publish is the explicit step that makes
// content live. Overlapping saves are guarded with refs.
//
// `normalize` is captured in a ref so callers may pass inline arrow
// functions without re-triggering the load effect on every render.

import { useCallback, useEffect, useRef, useState } from "react";
import { listStaged, publishItem, revertItem, updateStaged } from "@/lib/server-fns";
import { toast } from "sonner";

export interface UseCmsDraftOptions<T> {
  table: "pages" | "projects";
  slug: string;
  normalize: (raw: unknown) => T;
  autosaveMs?: number;
}

export interface UseCmsDraftReturn<T> {
  data: {
    published: T;
    staged: T;
    isPublic: boolean;
    publishedAt: string | null;
  } | null;
  doc: T;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: { kind: "ok" | "error"; text: string } | null;
  lastSaved: Date | null;
  patch: (updater: (doc: T) => T) => void;
  save: (options?: { silent?: boolean }) => Promise<boolean>;
  publish: () => Promise<boolean>;
  revert: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const notify = (text: string, kind: "ok" | "error" = "ok") => {
  const props: any = { duration: 2500 };
  if (kind === "error") props.className = "bg-destructive text-destructive-foreground";
  toast(text, props);
};

export function useCmsDraft<T>({
  table,
  slug,
  normalize,
  autosaveMs = 2000,
}: UseCmsDraftOptions<T>): UseCmsDraftReturn<T> {
  const [data, setData] = useState<{
    published: T;
    staged: T;
    isPublic: boolean;
    publishedAt: string | null;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Capture normalize in a ref so inline arrow callers don't recreate deps.
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  const baselineRef = useRef<T | null>(null);
  const saveRef = useRef<{ id: number }>({ id: 0 });
  const mountedRef = useRef(false);

  const doc = data ? data.staged : normalizeRef.current({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await (listStaged as any)({ data: { table } });
      const row = Array.isArray(rows) ? rows.find((r: any) => r.slug === slug) : undefined;
      if (!row) {
        throw new Error(`Row not found for slug ${slug}`);
      }
      const published = normalizeRef.current(row.published);
      const staged = normalizeRef.current(row.staged);
      baselineRef.current = staged;
      setData({
        published,
        staged,
        isPublic: row.isPublic,
        publishedAt: row.publishedAt ?? null,
      });
      setDirty(false);
      setNotice(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load draft");
      notify(err?.message ?? "Failed to load draft", "error");
    } finally {
      setLoading(false);
    }
  }, [table, slug]);

  // Load once on mount. table/slug are stable strings so this effect does not
  // re-run on subsequent renders.
  useEffect(() => {
    load();
  }, [load]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setError(null);
    setNotice(null);
  }, []);

  const patch = useCallback(
    (updater: (doc: T) => T) => {
      if (!data) return;
      const next = updater(data.staged);
      baselineRef.current = next;
      setData((prev) => (prev ? { ...prev, staged: next } : null));
      markDirty();
    },
    [data, markDirty],
  );

  const save = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (!data) return false;
      const nextId = (saveRef.current.id += 1);
      const myId = nextId;
      setSaving(true);
      setError(null);
      try {
        await (updateStaged as any)({
          data: { table, slug, content: data.staged },
        });
        if (myId !== saveRef.current.id) return false; // superseded
        baselineRef.current = data.staged;
        setDirty(false);
        setLastSaved(new Date());
        if (!options?.silent) {
          setNotice({ kind: "ok", text: "Saved as draft" });
          notify("Saved as draft");
          setTimeout(() => setNotice(null), 2000);
        }
        return true;
      } catch (err: any) {
        if (myId !== saveRef.current.id) return false;
        setError(err?.message ?? "Save failed");
        setNotice({ kind: "error", text: "Save failed" });
        notify(err?.message ?? "Save failed", "error");
        return false;
      } finally {
        if (myId === saveRef.current.id) setSaving(false);
      }
    },
    [data, table, slug],
  );

  // Debounced autosave to staged.
  useEffect(() => {
    if (!dirty || !mountedRef.current) return;
    const id = (saveRef.current.id += 1);
    const myId = id;
    const timer = setTimeout(async () => {
      if (myId !== saveRef.current.id) return;
      await save({ silent: true });
    }, autosaveMs);
    return () => {
      clearTimeout(timer);
    };
  }, [dirty, autosaveMs, save]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (!data) return false;
    const saved = await save({ silent: true });
    if (!saved) return false;
    try {
      setSaving(true);
      await (publishItem as any)({ data: { table, slug } });
      if (data) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                published: data.staged,
                isPublic: true,
                publishedAt: new Date().toISOString(),
              }
            : null,
        );
      }
      baselineRef.current = data.staged;
      setDirty(false);
      setLastSaved(new Date());
      setNotice({ kind: "ok", text: "Published" });
      notify("Published");
      setTimeout(() => setNotice(null), 2000);
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Publish failed");
      setNotice({ kind: "error", text: "Publish failed" });
      notify(err?.message ?? "Publish failed", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [data, table, slug, save]);

  const revert = useCallback(async (): Promise<boolean> => {
    if (!data) return false;
    try {
      setSaving(true);
      await (revertItem as any)({ data: { table, slug } });
      const { rows } = await (listStaged as any)({ data: { table } });
      const row = Array.isArray(rows) ? rows.find((r: any) => r.slug === slug) : undefined;
      if (!row) {
        throw new Error(`Row not found for slug ${slug}`);
      }
      const published = normalizeRef.current(row.published);
      const staged = normalizeRef.current(row.staged);
      baselineRef.current = staged;
      setData({ published, staged, isPublic: row.isPublic, publishedAt: row.publishedAt ?? null });
      setDirty(false);
      setNotice({ kind: "ok", text: "Reverted to published version" });
      notify("Reverted to published version");
      setTimeout(() => setNotice(null), 2000);
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Revert failed");
      setNotice({ kind: "error", text: "Revert failed" });
      notify(err?.message ?? "Revert failed", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [data, table, slug]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    doc,
    dirty,
    loading,
    saving,
    error,
    notice,
    lastSaved,
    patch,
    save,
    publish,
    revert,
    reload,
  };
}
