// Shared upload limit. The same value is used by the admin UI and enforced
// by `createMediaUpload`. Supabase Storage's own per-file cap must be equal
// or higher (Free plan: 50 MB; Pro: up to 500 GB via Storage settings).
export const MEDIA_MAX_BYTES =
  Number((import.meta.env as any).VITE_MEDIA_MAX_BYTES) || 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
