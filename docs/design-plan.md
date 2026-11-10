> [!IMPORTANT]
> **Archived design brief.** Written inside the Lovable editor during the
> original design phase, saved here as reference material when the project
> became self-owned. The design still applies; the tooling does not — the
> site has no Lovable coupling anymore (see README.md for the current stack).

# Developer Portfolio — Academic Catalog Style

A classy, editorial portfolio inspired by the uploaded university catalog page: white paper background, near-black ink, serif headings, thin hairline dividers, a solid black sidebar header block, and tab-style section switching. Focus: showcasing AI/ML skills and projects, with a New York Times editorial feel — classy, timeless, restrained (no flashy effects).

Flexible content blocks (built as reusable pieces with placeholders, so adding real content never breaks the layout):

- Image block (fixed aspect ratios, caption + credit line like a newspaper photo)
- Video block (YouTube/Vimeo/uploaded file, 16:9 frame with caption)
- Link card (title, source, short description)
- Code snippet block (monospace, syntax highlighting, copy button)
- File/certificate block (PDF preview or download card for any file type)
- Pull quote and callout blocks
- Pages are assembled from these blocks in a single content file, so new sections or features can be added later without redesigning.

## Visual direction

- Colors: white background, ink black (#1a1a1a) for blocks and active tabs, soft gray (#f0f0f0) for sidebar rows, muted gray text, steel-blue links (like the breadcrumbs).
- Fonts: serif wordmark/headings (Libre Baskerville for the name, Cormorant Garamond for large light titles), Lato for body text — matching the catalog feel.
- Details: hairline rules, uppercase small-caps labels ("2026 EDITION" style), breadcrumbs, no gradients, no rounded "app" look. Square corners.

## Pages and sections

```text
Header:  Your Name (serif wordmark) ............ search/menu icon
         "Portfolio 2026" subtitle
Breadcrumb: Home > Work > AI Engineering
Big light title: "Your Name, AI Engineer"
---------------------------------------------------------------
[ BLACK BLOCK: INDEX ]   |  [OVERVIEW] [PROJECTS] [SKILLS] [CONTACT] tabs
  About                  |
  AI Projects            |  Tab content area
    - LLM apps           |
    - Computer vision    |
  Skills                 |
  Writing / Research     |
  Experience             |
  Contact                |
```

1. Home (/) — overview: intro paragraph, "Areas of focus" numbered list (like the thesis conditions), featured AI projects.
2. Projects (/projects) — catalog-style list of AI projects with stack, role, and links; each opens a detail page (/projects/$slug) with problem, approach, models used, results.
3. Skills (/skills) — "Program Requirements"-style tables: LLMs & agents, RAG, ML/DL, MLOps, languages, frameworks.
4. Experience (/experience) — chronological entries in catalog format.
5. Contact (/contact) — email, GitHub, LinkedIn, simple contact form (front-end only for now).
6. Optional "Ask my portfolio" AI chat: visitors ask questions about you and an AI answers from your resume — a live demo of your AI skills. (Needs Lovable Cloud + Lovable AI; can be added in a second step.)

Mobile: sidebar collapses into a dropdown menu above the content.

Placeholder name, bio, and projects will be used — you can send real content afterwards.

## Tech stack

- TanStack Start (React 19, file-based routing, server-side rendering for good SEO)
- Vite 7 build tool
- Tailwind CSS v4 with design tokens for the catalog theme
- shadcn/ui components (tabs, tables, inputs) restyled square and monochrome
- Google Fonts: Libre Baskerville, Cormorant Garamond, Lato
- Content kept in a typed data file so projects/skills are easy to edit
- Optional: Lovable Cloud + Lovable AI Gateway for the "Ask my portfolio" chatbot and storing contact messages
- Deployed on Lovable hosting (edge), custom domain possible

## Technical details

- Routes: index, projects, projects.$slug, skills, experience, contact; shared layout (header, breadcrumb, sidebar index) in __root.
- Per-route head() metadata with unique titles/descriptions.
- Tokens in src/styles.css (oklch), font families via @theme; fonts loaded through link tags in root head.
