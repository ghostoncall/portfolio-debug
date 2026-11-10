# Smooth Scroll (Lenis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page scrolling feels smooth on mouse/trackpad while staying native on touch and for reduced-motion users.

**Architecture:** Lenis in React root (window-scroll) mode wraps the app shell in `__root.tsx`, toggled off at runtime when `prefers-reduced-motion` matches. Its stylesheet ships as a second head link via the existing `?url` import pattern. Router scroll restoration already handles nav/top.

**Tech Stack:** `lenis@1.3.27` (Runtime dependency), TanStack Start (React 19), existing Playwright venv at `/tmp/opencode/pwvenv` for behavioral verification.

**Spec:** Approved conversational design, 2026-11-05 (design message: install lenis, root mode, head-link CSS, wheel-only smoothing, touch native, reduced-motion native). Session ledger: /tmp/opencode/portfolio-sdd/ledger.md.

## Global Constraints

- Design parity: no visual change to the editorial layout (positions, fonts, colors untouched — scroll behavior only).
- No git commits (user permission not yet granted; machine rule).
- `vite.config.ts` plugin order must stay exactly as documented in AGENTS.md.
- Content stays in `src/content/site.ts`; never touch HTML for this.
- Package manager npm on Node 26.

## Review Focus

- Reduced-motion users → native scroll, no smoothing instance active. Test: Playwright `reduced_motion="reduce"` context → `html` must lack `lenis-smooth` class (T2).
- Touch devices → native momentum, no fighting with browser gestures. Test: mobile-viewport context loads, scrolls via touch drag, zero console errors (T2).
- Route navigation → click a menu link still lands instantly at page top. Test: scroll down, click "Projects" link → `scrollY === 0` after nav (T2).
- SSR/hydration → no hydration mismatch, zero console errors on load. Test: console-error capture across routes (T2).
- Production bundle → lenis + its CSS present in artifact, nothing else changes. Test: build, then check head reference + test suite green (T3).

---

### Task 1: Baseline RED — behavior check exists and fails today

**Files:**
- Create: `/tmp/opencode/lenis-check.py` (throwaway verify infra)

**Interfaces:**
- Consumes: dev server on http://localhost:8080 (running), Playwright venv python.
- Produces: script with exit code 0 = all checks pass; prints per-check labels.

- [ ] **Step 1: Write the check script** — checks A (html has `lenis lenis-smooth` classes), B (wheel ramp: one `mouse.wheel(0,1200)`, sampled `scrollY`; smoothing = <60% of distance reached in first two samples), C (nav-to-top regression), D (reduced-motion context lacks smoothing class), E (zero console errors).
- [ ] **Step 2: Run against current (pre-Lenis) dev server** — `python /tmp/opencode/lenis-check.py`; Expect: FAIL on A and B (page has no Lenis today). D trivially passes.

### Task 2: Install + wire Lenis — RED to GREEN

**Files:**
- Modify: `src/routes/__root.tsx` (smoothness wrapper + head link)
- Modify: `package.json`/`package-lock.json` via npm (dependency only)

**Interfaces:**
- Consumes: Task 1 script.
- Produces: `SmoothScroll({children})` component in `__root.tsx` wrapping `SiteHeader/Outlet/SiteFooter` inside `QueryClientProvider`; head gains `lenis/dist/lenis.css` link.

- [ ] **Step 1: Install** — `npm install lenis` (runtime dep); verify `node_modules/lenis/dist/lenis.css` exists.
- [ ] **Step 2: Edit `__root.tsx`** — add `import { ReactLenis } from "lenis/react"`; `import lenisCss from "lenis/dist/lenis.css?url"`; add `{ rel: "stylesheet", href: lenisCss }` to head links; add `SmoothScroll` component: `useState(true)` initial, `useEffect` syncing `matchMedia("(prefers-reduced-motion: reduce)")` → render `true ? <ReactLenis root>{children}</ReactLenis> : <>{children}</>`; wrap the three shell children.
- [ ] **Step 3: Restart dev server** (kill `vite dev`, `npm run dev` background, port 8080).
- [ ] **Step 4: Run `/tmp/opencode/lenis-check.py`** — Expect: PASS all of A–E. Screenshot desktop home + mobile home for parity.
- [ ] **Step 5: If C fails** (nav not reaching top because Lenis animates programmatic scroll) — add navigation sync in `SmoothScroll` via `useLenis` + `useRouterState` pathname effect calling `lenis.scrollTo(0, { immediate: true })`. Only on evidence.

### Task 3: Gates + ledger

- [ ] **Step 1: `npm test`** — 7/7 (jsdom suite unaffected).
- [ ] **Step 2: `npm run lint`** — 0 errors, ≤ the 11 pre-existing warnings.
- [ ] **Step 3: `npm run build`** (default cloudflare preset) — green; `.output/public/assets` contains the lenis css asset.
- [ ] **Step 4: Ledger** — record design doc location, rulings (wheel-only default, duration default untouched), verification evidence.
- [ ] **Step 5: Report** to user with dev URL + what changed. No commit (awaiting permission).
