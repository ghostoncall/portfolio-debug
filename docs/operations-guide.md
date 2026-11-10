# Operations Guide — Setup, Deploy, and Maintain

Step-by-step instructions for getting the portfolio + admin panel running.

---

## 1. Prerequisites

- Node.js 26 (via `~/.local/opt/node`)
- npm (comes with Node)
- Git
- A Supabase account and project

---

## 2. Clone the Repository

```bash
cd /home/ghost-malware/projects
git clone https://github.com/ghostsoncall/portfolio.git
cd portfolio
```

---

## 3. Install Dependencies

```bash
npm install
```

---

## 4. Set Up Environment Variables

Copy the template:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```ini
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
ADMIN_PASSWORD=<the password you want for /onlyme>
SESSION_SECRET=<run: openssl rand -hex 32>
```

### Get `DATABASE_URL` from Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click your `ai-portfolio` project
3. Click **Connect** → choose **Transaction pooler** (port 6543)
4. Copy the full string
5. Replace `[YOUR-PASSWORD]` with your Supabase database password

### Generate `SESSION_SECRET`

```bash
openssl rand -hex 32
```

Paste the output into `.env`.

---

## 5. Set Up the Database

Run the migration to create tables:

```bash
npm run db:migrate
```

Seed content from `src/content/site.ts` into both `published` and `staged` copies:

```bash
npm run db:seed
```

Expected output:
```
Seeded → pages: 3, projects: 3, posts: 2, settings: 1
```

The seed is idempotent — safe to re-run. Existing rows are never overwritten.

---

## 6. Run the Development Server

```bash
npm run dev
```

Visit:
- **Public site:** `http://localhost:8080`
- **Admin login:** `http://localhost:8080/onlyme`
- **Admin dashboard:** `http://localhost:8080/onlyme` (after login)

---

## 7. Verify Everything Works

### Type check
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

### Tests
```bash
npm test
```

### Build for production
```bash
NITRO_PRESET=node-server npm run build
PORT=4173 node .output/server/index.mjs
```

---

## 8. Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "your message"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) and connect your GitHub repo
3. Add these environment variables in Vercel project settings:
   - `DATABASE_URL` — your Supabase transaction pooler string
   - `ADMIN_PASSWORD` — your admin login password
   - `SESSION_SECRET` — a long random string
4. Vercel will auto-deploy on every push to `main`

---

## 9. Daily / Weekly Operations

### Backup (recommended weekly)

Visit `yoursite.com/onlyme/export` and click **Download backup JSON**. Save the file somewhere safe.

Supabase's free tier does **not** include automated backups, so this is your insurance.

### Supabase project paused?

Free projects pause after ~1 week of inactivity. Go to the Supabase dashboard and click **Resume project**.

### Need to reset the admin password?

Change `ADMIN_PASSWORD` in `.env` (local) or Vercel env vars (production), then restart the server.

---

## 10. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `/onlyme` shows "This page didn't load" | SSR error from `window` usage | Check terminal for error; ensure `typeof window !== "undefined"` guards are in place |
| `db:migrate` times out | Can't reach Supabase pooler | Check network; try Session pooler (port 5432) or different network |
| Login returns "Invalid password" | Wrong `ADMIN_PASSWORD` | Check `.env` matches what you type at login |
| Public site shows old content | Public routes still read `site.ts` | Update routes to query Supabase `published` copy |
| Build fails on plugin order | vite.config.ts plugin order changed | Restore: tailwind → tsconfigPaths → tanstackStart → nitro → react |

---

## 11. Useful Commands

```bash
# Start dev server
npm run dev

# Preview production build
npm run preview

# Generate new migration after schema changes
npm run db:generate

# Push schema directly (skip migration files)
npm run db:push

# Check types
npx tsc --noEmit

# Lint
npm run lint

# Run tests
npm test
```

---

## 12. Where to Get Help

- **Supabase docs:** `supabase.com/docs`
- **TanStack Start docs:** `tanstackstart.dev`
- **Drizzle ORM docs:** `drizzle.team/docs`
- **Supabase Dashboard:** `supabase.com/dashboard` → your project → Settings → Network (for IP allowlist)