# AI Portfolio

Personal portfolio — AI engineering work, projects, writing and experience.
Editorial "academic catalog" design: serif display type, hairline rules, ink-on-paper palette, square corners.

## Stack

- **TanStack Start** — React 19, file-based routing, SSR + server functions
- **Vite 8 + nitro** build tooling, **Tailwind CSS v4** with design tokens
- shadcn/ui components (restyled square + monochrome)
- Vitest + Testing Library for route/media tests

## Run

```bash
npm install
npm run dev        # http://localhost:8080
npm test
npm run lint
npm run build      # production bundle in .output/
```

## Editing content

All copy lives in **`src/content/site.ts`** as typed `Block` arrays — pages assemble from those blocks, so adding projects, posts or media never breaks the layout. Any media file (image/video/pdf/zip/YouTube link…) goes through the self-contained `Media` component in `src/components/media.tsx`.

## Admin CMS — `/onlyme`

A staged/publish CMS lives at `/onlyme` (Supabase Auth required). New in this release:

| Section | Route | Description |
|---|---|---|
| Dashboard | `/onlyme` | Overview + quick links |
| Pages | `/onlyme/pages` | `blocks`-kind pages only |
| Projects | `/onlyme/projects` | Drag-to-reorder list + full editor |
| Skills | `/onlyme/skills` | Categories + skills table + drawer editor |
| Certificates | `/onlyme/certificates` | Card list + image/PDF upload + expiry badges |
| Experience | `/onlyme/experience` | Timeline + draggable entries + full editor |
| Media | `/onlyme/media` | Asset library + upload |
| Blogs | `/onlyme/blogs` | Blog post editor |
| Export | `/onlyme/export` | Full backup download |

### Staged/publish lifecycle

Every CMS document lives as `staged` until you explicitly **Publish**. Workflow:

1. Edit → changes autosave to `staged` (debounced 2s)
2. Click **Save** to force an immediate staged write
3. Click **Publish** to copy `staged → published` in one atomic write
4. Click **Revert** to discard staged changes and restore the published version
5. Unpublished changes show an "unpublished changes" chip in the list

### Cross-document reference integrity

Skills and Certificates documents can reference Projects and Experience entries. When you save one of those documents, stale references are automatically cleaned up across documents (no database foreign keys — legacy JSONB never loses data).

### Admin auth

Every `/onlyme` server function calls `requireAdmin()`. Supabase Auth session is checked on every request. Only confirmed admin accounts may access `/onlyme` routes.

## Public pages

| Route | Source | Notes |
|---|---|---|
| `/` | `src/content/site.ts` | Featured projects (top 3 by featured→priority→sort) |
| `/projects` | DB `projects` table | Filters archived, drag order |
| `/projects/$slug` | DB `projects` table | Full detail view |
| `/skills` | DB `pages/skills` | Categories + visible skills |
| `/experience` | DB `pages/experience` | Timeline, newest first |
| `/skills` (certificates section) | DB `pages/certificates` | Visible certificates, expiry badge, clickable thumbnail → expanded viewer (image or PDF iframe) |

Certificate thumbnails on `/skills` are clickable — they open an expanded dark overlay viewer with the media at full size (image or PDF), plus "Open in new tab" links. Close with the X button, `Esc`, or clicking the backdrop.

## Media

User media (any file type, any count) goes through the `Media` component, which detects kind from the URL and keeps a fixed-ratio frame. Uploads go to Supabase Storage (public bucket — files are unlisted, not access-controlled).

## Database

Content rows live in Supabase tables keyed by `slug`:

| Table | Primary key | Columns |
|---|---|---|
| `pages` | `slug` | `slug`, `kind`, `published`, `staged`, `sort`, `publishedAt`, `updatedAt` |
| `projects` | `slug` | `slug`, `published`, `staged`, `isPublic`, `sort`, `publishedAt`, `updatedAt` |

`kind` on `pages` is an enum: `blocks`, `skills`, `certificates`, `experience`. Only `blocks` pages are editable in the Pages admin; skills/certificates/experience have dedicated editors.

## Migration

Run once to convert legacy content shapes to the new CMS model:

```bash
node scripts/migrate-cms-content.mjs
```

Idempotent — safe to re-run (changed: 0 on subsequent runs). Backup is written to `/tmp/opencode/cms-backup-*.json`.

## DB check (E2E helper)

Verify published/staged content directly from the database:

```bash
node scripts/e2e-dbcheck.mjs '{"slug":"skills","column":"published","needles":["React"],"expect":"present"}'
```

## Deployment

TanStack Start is Nitro-based and deploys to Vercel/Cloudflare/Node hosting. The default build targets `cloudflare-module`; on Vercel set `NITRO_PRESET=vercel` (or `preset: "vercel"` in the nitro config). Custom domain attaches at the host's dashboard with SSL auto-provisioning.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase transaction pooler connection string |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `ADMIN_EMAIL` | No | When set, only this email may access `/onlyme` |
| `ADMIN_PASSWORD` | Yes | Password typed at `/onlyme` login (not a DB credential) |

---

**© 2026 Your Name.** — the site footer renders the year automatically.
