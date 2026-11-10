# CMS: Projects, Skills, Certificates & Experience

**Branch:** `feat/blog-cpm` (from `40a124b`)  
**Status:** Complete — all 23 E2E tests pass, static gate green  
**Commit:** Pending user permission  
**Proposed message:** `feat(admin): professional CMS for projects, skills, certificates and experience`

---

## Summary

Extended the portfolio CMS (Architecture A: JSONB document model) to cover **Projects, Skills, Certificates, and Experience** — all admin-managed with verified public-site sync. Every new server function calls `requireAdmin`; validation is server-side via Zod; cross-document reference integrity is preserved (legacy JSONB never loses data).

## What was built

### Skills admin (`src/routes/onlyme.skills.tsx`)
- Categories: drag-to-reorder, rename, delete (only when empty), visible toggle
- Skills table: search + category filter, select-all, bulk move category / show / hide / delete, per-row edit / dup / hide / del
- Drawer (Sheet) editor: name, category, level, years, detail, description, visible/featured flags, related-project checkboxes
- One document (`pages/skills`); autosave to staged, explicit Publish, Revert, unsaved-changes guard

### Certificates admin (`src/routes/onlyme.certificates.tsx`)
- Certificate cards: search + category + featured filters, expiry badge (Expired / Expires soon / Valid), image thumbnail
- Drawer editor: title, issuer, issue/expiry dates (DateField with expiry≥issue validation), credential ID/URL (with “Test” link), category, description, visible/featured, image + PDF upload via Media library, skill multi-select
- Full-size preview via public `CertificatesView`; duplicate/delete guarded by ConfirmDialog

### Experience admin (`src/routes/onlyme.experience.tsx`)
- Experience entries: drag-to-reorder (highest sort = newest first), per-row edit / dup / hide / del
- Drawer editor: role, org, employment type, work mode, location, start/end dates (endDate hidden when “Current”), overview, responsibilities & achievements line-lists, tech TagInput, skills + projectSlugs multi-selects, logo + media gallery, links
- Timeline preview reuses public `ExperienceView` inline

### Sidebar (`src/routes/onlyme.tsx`)
- Added Skills / Certificates / Experience nav items alongside Projects; Pages keeps only `blocks` pages

### Pages cleanup (`src/routes/onlyme.pages.tsx`, `onlyme.pages.$slug.tsx`)
- `onlyme.pages.$slug.tsx` rewritten on `useCmsDraft`; only `blocks` kind is editable here
- `skills` / `certificates` / `experience` page rows redirect to their dedicated admins
- `onlyme.pages.tsx` list routes Edit links accordingly

## Key fixes (pre-existing issues uncovered during build)

1. **`useCmsDraft` (`src/components/admin/cms/useCmsDraft.ts`)**: Captured `normalize` in a ref so inline arrow callers don't recreate effect deps on every render (was causing infinite re-renders → stuck on “Loading draft…”). Switched from broken `getStaged` (GET server fn drops query params) to `listStaged` + client-side slug filter.
2. **`updateStaged` (`src/lib/server-fns.ts`)**: Removed stray `await tx` lines that broke the transaction; simplified to a direct DB write.
3. **`DateField` / `FormSection` / `MediaField` / `MediaGallery`**: Props made `undefined`-safe per `exactOptionalPropertyTypes` convention.
4. **`certificateSchema` (`src/lib/cms-validation.ts`)**: Made `issuer` optional so pre-existing certificates with empty issuers pass `assertValidContent` during `publishItem`.
5. **Public `ExperienceView`**: Legacy entries without ISO dates no longer crash `parseISO`; renders `website` and `links` fields.

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` (changed files) | PASS |
| `npx vitest run` | 47/47 PASS |
| `npm run build` | PASS |
| Headed Playwright E2E | 23/23 PASS |

### E2E coverage (per user directive)
Visible headed browser, admin via `/onlyme/login`, navigating Projects/Skills/Certificates/Experience admins, clicking every relevant button: create, edit, save, delete, reorder, duplicate, hide/show, publish, revert, bulk, media upload + preview. Persistence verified against Supabase (direct DB reads between steps). Public-site reflection verified on `/skills` and `/experience`. Real browser interactions including failures, screenshots (`/tmp/e2e_cms/`) and console-error capture. `e2e-` prefixed fixtures cleaned up afterwards.

### Screenshots
`/tmp/e2e_cms/` — numbered PNGs for every key step (login, category add, skill add/edit/hide/show/dup/publish/public, certificate add/upload/edit/publish/public, experience add/current/reorder/publish/public, final state).

## Known limitations (documented, pre-existing)
- `ADMIN_EMAIL` empty; public signups enabled; media bucket is public (certificate files unlisted, not access-controlled)
- Stray artifacts outside CMS scope: `admin@testportfolio.com` unconfirmed account, `https://example.com` placeholders in RSS/sitemap, stale `docs/operations-guide.md`, placeholder values in `src/content/site.ts`

## Next steps (post-CMS)
1. Resolve blog-audit leftovers (Save staged buttons, Pages Create/Delete)
2. Secure credentials (set `ADMIN_EMAIL`, rotate test credential)
3. Deploy (`wrangler login` + Supabase admin access)
