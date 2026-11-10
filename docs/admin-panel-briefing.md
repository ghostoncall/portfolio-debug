# Admin Panel & Database — Explainer Doc

Everything we built, how the user experience works, and what to learn next.

---

## 1. What We Built

### The Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TanStack Start + Vite 8 + Tailwind v4 | Portfolio UI |
| Server | TanStack Start server functions + Nitro | Server-only DB access + auth guard |
| Database | Supabase (PostgreSQL) | Stores content in `published` + `staged` JSONB copies |
| Auth | Custom signed http-only cookie | Protects `/onlyme` — no Supabase Auth used |
| Migrations | Drizzle Kit | Creates/updates DB tables |
| Version control | Git → GitHub (`ghostsoncall/portfolio`) | Code history and deploy source |

### Why Supabase

We evaluated Turso vs Neon vs Supabase. Supabase won because:

1. **PostgreSQL + JSONB** — our block-card content is document-shaped, and JSONB gives real indexing (MySQL can't index JSON directly).
2. **Free tier IPv4 pooler** — works on Vercel without an IPv4 add-on.
3. **Dashboard UI** — table browser, SQL editor, logs for troubleshooting.
4. **Engine-swap safety** — Drizzle ORM supports both Postgres and SQLite, so switching engines later is a config change.

### Staging & Publish Model

Every editable item keeps **two copies** in the database:

| Column | Purpose |
|--------|---------|
| `published` | What the public website serves |
| `staged` | What you're currently editing in `/onlyme` |

**Workflow:**
- **Edit** → writes to `staged` only (public site unchanged)
- **Publish** → copies `staged` → `published`, stamps `published_at`
- **Revert** → discards staged edits, copies `published` back to `staged`
- **Publish all** → publishes every staged change across all sections

### Database Schema (4 tables in Supabase)

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `pages` | `slug`, `title`, `kind`, `published` (JSONB), `staged` (JSONB) | Pages: Overview, Skills, Experience |
| `projects` | `slug`, `published`, `staged`, `is_public` | Your projects |
| `posts` | `slug`, `published`, `staged`, `is_public` | Your blog posts |
| `settings` | `id`, `published`, `staged` | Site identity (name, email, socials) |

---

## 2. User Experience Walkthrough

### Experience 1: Logging into `/onlyme`

**What you see:** A centered login form asking for the admin password. Below it: "Signed session cookie • 7 days".

**What happens:** You type your `ADMIN_PASSWORD`. The server verifies it via the `verifyPassword` server function. If correct, a signed cookie (`admin_session`) is set in your browser (http-only, 7-day expiry). You're redirected to `/onlyme`.

**What we built:**
- `src/lib/auth.ts` — cookie signing/verification with HMAC-SHA256
- `src/routes/onlyme.login.tsx` — login form + `verifyPassword` server function
- `src/routes/onlyme.tsx` — layout with cookie check and redirect logic

---

### Experience 2: Dashboard

**What you see:** Four cards (Pages, Projects, Blogs, Settings) plus a "Publish all" button and a "Sign out" button in the sidebar.

**What you can do:** Click any card to enter that section. Click **Publish all** to push every staged change across all sections to public at once.

**What we built:**
- `src/routes/onlyme.index.tsx` — dashboard
- `src/lib/server-fns.ts` — `publishAll` server function

---

### Experience 3: Editing Settings

**What you see:** Form fields for Site name, Title, Edition, Email, and a Socials list (label + href pairs, with add/remove buttons). Three action buttons: **Save staged**, **Publish**, **Revert**.

**What happens:**
- **Save staged** → writes to the `staged` copy only. Public site unchanged.
- **Publish** → copies `staged` → `published`. Public site updates.
- **Revert** → discards staged changes, restores `staged` from `published`.

**What we built:**
- `src/routes/onlyme.settings.tsx` — form with inline socials editor

---

### Experience 4: Editing Pages (Block-Card Editor)

**What you see:** A list of blocks (text, heading, image, media, etc.), each in its own card with delete button. An "Add block" dropdown at the top. Block-specific form fields for each type.

**Block types available:**
- `text`, `heading`, `list`, `image`, `video`, `link`, `code`, `file`, `quote`, `callout`, `media`

**What happens:** Changes update local state. **Save staged** persists the full block array to the database's `staged` copy.

**What we built:**
- `src/components/admin/BlockEditor.tsx` — 11 block-type form editors
- `src/routes/onlyme.pages.tsx` — page list with publish/revert per row
- `src/routes/onlyme.pages.$slug.tsx` — individual page editor

---

### Experience 5: Editing Projects

**What you see:** Fields for Title, Dek, Year, Category, Stack (comma-separated), plus the Blocks editor below.

**What we built:**
- `src/routes/onlyme.projects.tsx` — project list table
- `src/routes/onlyme.projects.$slug.tsx` — project editor

---

### Experience 6: Editing Blogs

**What you see:** Fields for Title, Dek, Date, Read time, Tags, plus the Blocks editor.

**What we built:**
- `src/routes/onlyme.blogs.tsx` — post list table
- `src/routes/onlyme.blogs.$slug.tsx` — post editor

---

### Experience 7: Publishing

**Two modes:**

| Mode | Trigger | Scope |
|------|---------|-------|
| Per-item | Click **Publish** on any edit page | One page/project/post/settings |
| All at once | Click **Publish all** on Dashboard | Everything across all tables |

**What happens:** For each item, `staged` → `published`, `published_at` = now. Public site reads `published` only.

**What we built:**
- `publishItem` (per-item), `publishAll` (bulk) server functions

---

### Experience 8: Backup Export

**What you see:** A "Download backup JSON" button.

**What happens:** Downloads a `.json` file with all published content from all 4 tables. Run this regularly — Supabase free tier has no automated backups.

**What we built:**
- `src/routes/onlyme.export.tsx` — backup download page
- `exportBackup` server function

---

## 3. File Structure (What We Created)

```
src/
├── db/
│   ├── schema.ts      # 4 tables, published+staged JSONB copies
│   ├── client.ts      # Server-only DB connection (pooler mode)
│   └── seed.ts        # Idempotent seed from site.ts
├── lib/
│   ├── auth.ts        # Signed cookie session (HMAC-SHA256)
│   └── server-fns.ts  # All CRUD + publish/revert/export server functions
├── components/
│   └── admin/
│       └── BlockEditor.tsx  # 11 block-type form editors
└── routes/
    ├── onlyme.tsx              # Layout with auth guard
    ├── onlyme.index.tsx        # Dashboard + Publish all
    ├── onlyme.login.tsx        # Login + verifyPassword server fn
    ├── onlyme.settings.tsx     # Settings editor
    ├── onlyme.pages.tsx        # Pages list
    ├── onlyme.pages.$slug.tsx  # Page editor
    ├── onlyme.projects.tsx     # Projects list
    ├── onlyme.projects.$slug.tsx # Project editor
    ├── onlyme.blogs.tsx        # Blogs list
    ├── onlyme.blogs.$slug.tsx  # Blog editor
    └── onlyme.export.tsx       # Backup download
```

Config files:
- `drizzle.config.ts` — Drizzle Kit config
- `drizzle/0000_striped_kingpin.sql` — Generated migration SQL
- `.env.example` — Template for your 3 environment variables
- `package.json` — Added `db:generate`, `db:migrate`, `db:push`, `db:seed` scripts

---

## 4. Supabase Features Available to You

| Feature | Status | Notes |
|---------|--------|-------|
| PostgreSQL database | ✅ Connected | Your 4 tables live here |
| Connection pooler | ✅ Active | Port 6543, transaction mode |
| Dashboard UI | ✅ Available | Browse tables, run SQL, view logs |
| Auth | ⚠️ Available but unused | We built custom cookie auth instead |
| Storage | ⚠️ Available but unused | S3-style file storage (for images/files later) |
| Realtime | ⚠️ Available but unused | WebSocket live updates |
| Edge Functions | ⚠️ Available but unused | Serverless functions |
| Automated backups | ❌ Not on free tier | Use `/onlyme/export` instead |

**Free tier limits:** 500 MB database, 2 active projects max, free projects pause after ~1 week of inactivity (resume in dashboard).

---

## 5. What to Learn — Topics & Tech Stack

### Phase 1: Understand what's already built (1–2 weeks)

| Topic | Why | Where to learn |
|-------|-----|----------------|
| **TanStack Start** | Your framework — routing, server functions, SSR | `tanstackstart.dev` |
| **Drizzle ORM** | Database queries in `src/lib/server-fns.ts` | `drizzle.team/docs` |
| **PostgreSQL JSONB** | Content stored as JSON documents | `postgresqltutorial.com` |
| **Signed cookies** | How `/onlyme` auth works without sessions | MDN Web Docs (HTTP cookies) |
| **HMAC-SHA256** | Cookie signing mechanism | Any crypto intro |

### Phase 2: Connect public site to Supabase (next step)

| Topic | Why |
|-------|-----|
| **Server-side data fetching** | Update `src/routes/` to read from DB `published` instead of `site.ts` |
| **Environment variables on server** | `DATABASE_URL` must reach Supabase from your host |
| **Nitro/Node server preset** | How your site builds for production |
| **TypeScript type narrowing** | `data.content as PageContent` patterns |

### Phase 3: Deploy & operate

| Topic | Why |
|-------|-----|
| **Vercel deployment** | Connect GitHub repo, add env vars, auto-deploy on push |
| **Git workflow** | Commit, push, pull requests |
| **Supabase dashboard** | Browse tables, run SQL, check logs, resume paused project |
| **Backup routine** | Regular `/onlyme/export` downloads, or script it |

### Phase 4: Extend (optional, later)

| Topic | Why |
|-------|-----|
| **Supabase Auth** | Replace custom cookie auth with email/password + OAuth |
| **Supabase Storage** | Host uploaded images/files instead of external URLs |
| **Row Level Security (RLS)** | Database-level permission rules |
| **Vercel + Supabase integration** | Native connector for easier deployment |

### Recommended Tech Stack to Learn

| Category | Technology | Use Case |
|----------|-----------|----------|
| Framework | TanStack Start (React 19) | Full-stack React |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| ORM | Drizzle | Type-safe SQL queries |
| Database | PostgreSQL + JSONB | Relational + document data |
| Auth | Signed cookies / JWT | Session management |
| Deployment | Vercel or AWS EC2 | Hosting |
| CI/CD | GitHub Actions | Auto-deploy on push |

### Learning Order

1. **This week:** TanStack Start docs → server functions + file-based routing
2. **Next week:** Drizzle ORM → select/insert/update/delete patterns
3. **Following week:** Deploy to Vercel → GitHub connect + env vars
4. **Ongoing:** Supabase dashboard → table browser, SQL editor, logs

---

## 6. Quick Reference Card

| Task | Command / Action |
|------|------------------|
| Start dev server | `npm run dev` |
| Apply DB migration | `npm run db:migrate` |
| Seed content | `npm run db:seed` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Login to admin | `yoursite.com/onlyme` + your `ADMIN_PASSWORD` |
| Download backup | `yoursite.com/onlyme/export` |
| Resume paused Supabase | Dashboard → Resume project |
| Get connection string | Dashboard → Connect → Transaction pooler |

---

## 7. Next Steps

1. **Run migration + seed** on your local machine: `npm run db:migrate` then `npm run db:seed`
2. **Deploy to Vercel** — connect GitHub repo, add `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` as env vars
3. **Update public routes** to read from Supabase `published` instead of `site.ts`
4. **Test `/onlyme`** end-to-end on the live site
5. **Set up backup routine** — regular `/onlyme/export` downloads