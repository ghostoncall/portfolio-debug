/* eslint-disable @typescript-eslint/no-explicit-any */
// Media library: every file lives in Supabase Storage; this page manages the
// metadata row. Uploads go straight from the browser to Storage with a signed
// URL, so large files never pass through the app server.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, ImageIcon, Loader2, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { deleteMedia, getMediaUsage, listMedia, updateMedia } from "@/lib/server-fns";
import { MediaThumb } from "@/components/admin/MediaPicker";
import { formatBytes, MEDIA_MAX_BYTES } from "@/lib/media-config";
import { uploadFileToLibrary } from "@/lib/media-upload";
import type { MediaAssetRow } from "@/db/schema";

export const Route = createFileRoute("/onlyme/media")({
  component: MediaLibrary,
});

type Filter = "all" | "image" | "video" | "audio" | "document";

const field =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function matchesFilter(asset: MediaAssetRow, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "image") return asset.type.startsWith("image/");
  if (filter === "video") return asset.type.startsWith("video/");
  if (filter === "audio") return asset.type.startsWith("audio/");
  return !/^(image|video|audio)\//.test(asset.type);
}

function kindLabel(asset: MediaAssetRow) {
  const [, sub] = asset.type.split("/");
  return (sub ?? "file").toUpperCase();
}

function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MediaAssetRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setError(null);
      const rows = (await (listMedia as any)()) as MediaAssetRow[];
      setAssets(rows);
    } catch (err: any) {
      setError(err?.message ?? "Could not load the media library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = assets
      .filter((asset) => matchesFilter(asset, filter))
      .filter((asset) => !term || asset.name.toLowerCase().includes(term));
    return rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const at = new Date(a.uploadedAt).getTime();
      const bt = new Date(b.uploadedAt).getTime();
      return sort === "newest" ? bt - at : at - bt;
    });
  }, [assets, search, filter, sort]);

  const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        setProgress(Math.round((index / files.length) * 100));
        if (file.size > MEDIA_MAX_BYTES) {
          throw new Error(`“${file.name}” is larger than ${formatBytes(MEDIA_MAX_BYTES)}.`);
        }
        await uploadFileToLibrary(file, {
          onProgress: (percent) =>
            setProgress(Math.round(((index + percent / 100) / files.length) * 100)),
        });
      }
      setProgress(100);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-foreground">Media library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length} file{assets.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} total ·
            limit {formatBytes(MEDIA_MAX_BYTES)} per file
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? `Uploading ${progress}%` : "Upload files"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-muted/30 p-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className={`${field} pl-8`}
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className={`${field} w-auto`}
        >
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="document">Documents & files</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={`${field} w-auto`}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Filename A–Z</option>
        </select>
      </div>

      {(uploading || progress > 0) && (
        <div className="h-1 w-full bg-muted">
          <div className="h-1 bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading files…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border py-20 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-sm">
            {assets.length === 0
              ? "No files yet. Upload your first image, video, audio file or document."
              : "No files match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((asset) => (
            <article key={asset.id} className="group flex flex-col bg-background">
              <button
                type="button"
                onClick={() => setDetail(asset)}
                className="relative aspect-[4/3] overflow-hidden bg-muted text-left"
                title="Open details"
              >
                <MediaThumb asset={asset} />
                <span className="absolute left-1 top-1 bg-background/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {kindLabel(asset)}
                </span>
              </button>
              <div className="flex flex-1 flex-col gap-1 p-2">
                <p className="truncate text-xs text-foreground" title={asset.name}>
                  {asset.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(asset.size)}
                  {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDetail(asset)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <MediaDetail
          asset={detail}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            await load();
          }}
          onDeleted={async () => {
            setDetail(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function MediaDetail({
  asset,
  onClose,
  onChanged,
  onDeleted,
}: {
  asset: MediaAssetRow;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(asset.name);
  const [alt, setAlt] = useState(asset.alt ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [usage, setUsage] = useState<{ kind: string; ref: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (getMediaUsage as any)({ data: { id: asset.id } })
      .then((rows: any) => setUsage(rows))
      .catch(() => setUsage([]));
  }, [asset.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await (updateMedia as any)({ data: { id: asset.id, name, alt, caption } });
      await onChanged();
    } catch (err: any) {
      setError(err?.message ?? "Could not save details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete “${asset.name}” permanently? Files still used in a post cannot be deleted.`,
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      await (deleteMedia as any)({ data: { id: asset.id } });
      await onDeleted();
    } catch (err: any) {
      setError(err?.message ?? "Could not delete this file.");
      setDeleting(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the URL field and copy it manually.");
    }
  }

  const isImage = asset.type.startsWith("image/");
  const isVideo = asset.type.startsWith("video/");
  const isAudio = asset.type.startsWith("audio/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="truncate text-base font-medium text-foreground">{asset.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex items-center justify-center bg-muted/40 p-5">
            {isImage ? (
              <img
                src={asset.url}
                alt={asset.alt ?? asset.name}
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
            ) : isVideo ? (
              <video src={asset.url} controls className="max-h-[60vh] w-full" />
            ) : isAudio ? (
              <audio src={asset.url} controls className="w-full" />
            ) : asset.type === "application/pdf" ? (
              <iframe
                src={asset.url}
                title={asset.name}
                className="h-[55vh] w-full border border-border"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <p className="text-sm">No inline preview for this file type.</p>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-link hover:underline"
                >
                  Open file ↗
                </a>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-border p-5 md:border-l md:border-t-0">
            {error && (
              <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-foreground">{asset.type || "unknown"}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="text-foreground">{formatBytes(asset.size)}</dd>
              <dt className="text-muted-foreground">Dimensions</dt>
              <dd className="text-foreground">
                {asset.width && asset.height ? `${asset.width} × ${asset.height}px` : "—"}
              </dd>
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd className="text-foreground">{new Date(asset.uploadedAt).toLocaleDateString()}</dd>
              <dt className="text-muted-foreground">Used by</dt>
              <dd className="text-foreground">
                {usage === null
                  ? "Checking…"
                  : usage.length === 0
                    ? "Nothing"
                    : `${usage.length} item${usage.length === 1 ? "" : "s"}`}
              </dd>
            </dl>

            {usage && usage.length > 0 && (
              <ul className="space-y-1 border border-border p-2 text-xs text-muted-foreground">
                {usage.map((ref, index) => (
                  <li key={`${ref.kind}-${ref.ref}-${index}`} className="truncate">
                    {ref.kind}: <span className="font-mono text-foreground">{ref.ref}</span>
                  </li>
                ))}
              </ul>
            )}

            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Filename</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Alt text</span>
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Describe the image for screen readers"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Caption</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                className={`${field} resize-y`}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save details"}
              </button>
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="inline-flex items-center gap-1 border border-input px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy URL"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-1 border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Public URL</span>
              <input readOnly value={asset.url} className={`${field} font-mono text-xs`} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
