// All portfolio content lives here. Pages are assembled from flexible "blocks",
// so you can add images, videos, links, code, files or new block types without
// touching the layout.
//
// For ANY file (jpg, png, mp4, pdf, ppt, docx, YouTube link, zip…) use the
// "media" block. Leave `items` empty for placeholders; add as many items as
// you like and it becomes a carousel automatically.

import type { MediaItem } from "@/components/media";

export type { MediaItem };

export type Block =
  | {
      type: "media";
      items?: MediaItem[];
      count?: number;
      layout?: "carousel" | "grid" | "stack";
      ratio?: string;
      fit?: "cover" | "contain";
      caption?: string;
      credit?: string;
    }
  | { type: "text"; body: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | {
      type: "image";
      src?: string;
      alt: string;
      caption?: string;
      credit?: string;
      ratio?: "16/9" | "4/3" | "1/1" | "3/2";
    }
  | { type: "video"; src?: string; embed?: string; caption?: string }
  | { type: "link"; href: string; title: string; source?: string; description?: string }
  | { type: "code"; language: string; code: string; caption?: string }
  | { type: "file"; href?: string; name: string; kind?: string; description?: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; body: string };

export const site = {
  name: "Your Name",
  title: "AI Engineer",
  edition: "Portfolio 2026",
  email: "you@example.com",
  socials: [
    { label: "GitHub", href: "https://github.com/" },
    { label: "LinkedIn", href: "https://linkedin.com/" },
  ],
};

export const overview: Block[] = [
  {
    type: "text",
    body: "I design and build applied AI systems — from retrieval-augmented assistants to computer-vision pipelines — with a focus on reliability, evaluation and thoughtful product craft.",
  },
  { type: "heading", text: "Areas of Focus" },
  {
    type: "list",
    ordered: true,
    items: [
      "Large language model applications, agents and tool use.",
      "Retrieval-augmented generation and semantic search.",
      "Computer vision and multimodal models.",
      "MLOps: evaluation, deployment and monitoring in production.",
    ],
  },
  {
    type: "media",
    caption: "Featured media — a photo, video, slide deck or any file.",
    credit: "Your Name",
  },
  {
    type: "quote",
    text: "Good AI is mostly good engineering, with a little magic at the edges.",
    cite: "Working principle",
  },
];

export type ProjectStatus = "completed" | "in-progress" | "upcoming" | "archived";

export type ProjectLink = {
  id: string;
  label: string;
  href: string;
  kind: "live" | "github" | "docs" | "demo" | "other";
};

export type Project = {
  slug: string;
  title: string;
  dek: string;
  year: string;
  category: string;
  stack: string[];
  blocks: Block[];
  summary?: string;
  status?: ProjectStatus;
  featured?: boolean;
  priority?: number;
  duration?: string;
  role?: string;
  achievements?: string[];
  challenges?: string;
  thumbnail?: MediaItem;
  cover?: MediaItem;
  gallery?: MediaItem[];
  video?: MediaItem;
  links?: ProjectLink[];
  skillIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type SkillCategory = {
  id: string;
  name: string;
  sort: number;
  visible?: boolean;
};

export type Skill = {
  id: string;
  name: string;
  categoryId: string;
  detail?: string;
  description?: string;
  level?: SkillLevel;
  years?: number;
  icon?: MediaItem;
  featured?: boolean;
  visible?: boolean;
  projectSlugs?: string[];
  sort: number;
};

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: string;
  category?: string;
  featured?: boolean;
  visible?: boolean;
  sort: number;
  image?: MediaItem;
  file?: MediaItem;
  skillIds?: string[];
};

export type ExperienceEmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "freelance"
  | "internship";

export type ExperienceWorkMode = "on-site" | "remote" | "hybrid";

export type ExperienceEntry = {
  id: string;
  role: string;
  org: string;
  employmentType?: ExperienceEmploymentType;
  location?: string;
  workMode?: ExperienceWorkMode;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  period?: string;
  overview?: string;
  responsibilities?: string[];
  achievements?: string[];
  tech?: string[];
  skillIds?: string[];
  projectSlugs?: string[];
  logo?: MediaItem;
  website?: string;
  links?: ProjectLink[];
  media?: MediaItem[];
  visible?: boolean;
  sort: number;
  blocks?: Block[];
};

export type SkillsPageContent = {
  kind: "skills";
  categories: SkillCategory[];
  skills: Skill[];
};

export type CertificatesPageContent = {
  kind: "certificates";
  certificates: Certificate[];
};

export type ExperiencePageContent = {
  kind: "experience";
  entries: ExperienceEntry[];
};

/** A page body. `kind` tells the admin editor which form shape to render. */
export type PageContent =
  | { kind: "blocks"; blocks: Block[] }
  | SkillsPageContent
  | CertificatesPageContent
  | ExperiencePageContent;

export type PageKind = PageContent["kind"];

export const projects: Project[] = [
  {
    slug: "rag-research-assistant",
    title: "Research Assistant with Retrieval",
    dek: "A citation-grounded assistant that answers questions over thousands of papers.",
    year: "2026",
    category: "LLM Applications",
    stack: ["Python", "LangChain", "pgvector", "OpenAI", "FastAPI"],
    blocks: [
      { type: "heading", text: "The Problem" },
      {
        type: "text",
        body: "Describe the problem, who it was for, and why existing tools fell short.",
      },
      {
        type: "image",
        alt: "Project screenshot",
        caption: "Screenshot of the interface.",
        ratio: "16/9",
      },
      { type: "heading", text: "Approach" },
      { type: "text", body: "Explain architecture, models chosen and trade-offs." },
      {
        type: "code",
        language: "python",
        caption: "Hybrid retrieval, simplified.",
        code: `def retrieve(query: str, k: int = 8):
    dense = vector_store.search(embed(query), k=k)
    sparse = bm25.search(query, k=k)
    return rerank(query, dense + sparse)[:k]`,
      },
      {
        type: "media",
        count: 4,
        caption: "Demo gallery — videos, screenshots, slides or documents.",
      },
      { type: "heading", text: "Results" },
      {
        type: "list",
        items: ["Answer accuracy up 32% over baseline.", "Median latency under 1.2s."],
      },
      {
        type: "link",
        href: "https://github.com/",
        title: "Source code",
        source: "GitHub",
        description: "Repository and documentation.",
      },
    ],
  },
  {
    slug: "vision-defect-detection",
    title: "Visual Defect Detection",
    dek: "A real-time vision model spotting manufacturing defects on the line.",
    year: "2025",
    category: "Computer Vision",
    stack: ["PyTorch", "YOLO", "ONNX", "Docker"],
    blocks: [
      { type: "text", body: "Summary of the project, data, and outcome." },
      { type: "image", alt: "Detection results", caption: "Sample detections.", ratio: "3/2" },
      { type: "callout", title: "Outcome", body: "Reduced manual inspection time by 60%." },
    ],
  },
  {
    slug: "agentic-workflow",
    title: "Agentic Workflow Automation",
    dek: "Tool-using agents that triage support tickets and draft replies.",
    year: "2025",
    category: "Agents",
    stack: ["TypeScript", "LLM tool calling", "Postgres"],
    blocks: [{ type: "text", body: "Describe the agent design, guardrails and evaluation." }],
  },
];

export const skills: SkillsPageContent = {
  kind: "skills",
  categories: [
    { id: "cat-llms-agents", name: "LLMs & Agents", sort: 0 },
    { id: "cat-retrieval", name: "Retrieval", sort: 1 },
    { id: "cat-machine-learning", name: "Machine Learning", sort: 2 },
    { id: "cat-engineering", name: "Engineering", sort: 3 },
  ],
  skills: [
    {
      id: "skill-prompt-tool-design",
      name: "Prompt & tool design",
      categoryId: "cat-llms-agents",
      detail: "Function calling, structured output",
      level: "advanced",
      years: 3,
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-agents",
      name: "Agents",
      categoryId: "cat-llms-agents",
      detail: "Planning, memory, multi-step workflows",
      level: "advanced",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-evaluation",
      name: "Evaluation",
      categoryId: "cat-llms-agents",
      detail: "Golden sets, LLM-as-judge, regression tests",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 2,
    },
    {
      id: "skill-rag",
      name: "RAG",
      categoryId: "cat-retrieval",
      detail: "Chunking, hybrid search, reranking",
      level: "advanced",
      years: 3,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-vector-databases",
      name: "Vector databases",
      categoryId: "cat-retrieval",
      detail: "pgvector, Pinecone, FAISS",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-deep-learning",
      name: "Deep learning",
      categoryId: "cat-machine-learning",
      detail: "PyTorch, fine-tuning, LoRA",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-computer-vision",
      name: "Computer vision",
      categoryId: "cat-machine-learning",
      detail: "Detection, segmentation",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-languages",
      name: "Languages",
      categoryId: "cat-engineering",
      detail: "Python, TypeScript, SQL",
      level: "expert",
      years: 5,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-mlops",
      name: "MLOps",
      categoryId: "cat-engineering",
      detail: "Docker, CI/CD, monitoring",
      level: "advanced",
      years: 3,
      visible: true,
      sort: 1,
    },
  ],
};

export const certificates: CertificatesPageContent = {
  kind: "certificates",
  certificates: [
    {
      id: "cert-ml-specialization",
      title: "Machine Learning Specialization",
      issuer: "Coursera / Stanford University",
      issueDate: "2024-01-01",
      credentialId: "ML-SPEC-2024-0001",
      credentialUrl: "https://coursera.org/verify/ML-SPEC-2024-0001",
      description: "Foundations of machine learning and supervised/unsupervised algorithms.",
      category: "Machine Learning",
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "cert-cloud-ai-practitioner",
      title: "Cloud AI Practitioner",
      issuer: "Cloud Provider Academy",
      issueDate: "2024-06-01",
      description: "Certificate placeholder — attach your file.",
      category: "Cloud",
      visible: true,
      sort: 1,
    },
  ],
};

export type PostBody = {
  /** Lexical editor state (Koenig / Ghost). Opaque to the rest of the app. */
  lexical: Record<string, unknown>;
  /** Rendered HTML captured from the editor; what the public site displays. */
  html: string;
};

export type PostSEO = {
  title?: string;
  description?: string;
  canonical?: string;
  socialImage?: string;
};

/** Who can read a published post. */
export type PostVisibility = "public" | "unlisted" | "private";

export type Post = {
  slug: string;
  title: string;
  /** Short description / excerpt. */
  dek: string;
  /** ISO date, e.g. "2026-10-12" */
  date: string;
  readTime?: string;
  tags: string[];
  /** Optional cover — any file type. Leave src empty for a placeholder. */
  cover: MediaItem | undefined;
  /** Legacy structured body. Kept for pages written before the Koenig editor. */
  blocks: Block[];
  /** Rich body written with the Koenig editor. Takes precedence over `blocks`. */
  body?: PostBody;
  author: string | undefined;
  /** Featured on the blog index when blog settings enable a featured post. */
  featured: boolean | undefined;
  /** public = listed and readable; unlisted = readable by URL; private = admin only. */
  visibility?: PostVisibility;
  seo: PostSEO | undefined;
};

export const posts: Post[] = [
  {
    slug: "evaluating-rag-systems",
    title: "How I Evaluate Retrieval-Augmented Systems",
    dek: "Golden sets, failure taxonomies and why a single accuracy number is never enough.",
    date: "2026-10-12",
    readTime: "8 min read",
    tags: ["RAG", "Evaluation"],
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
    blocks: [
      {
        type: "text",
        body: "Opening paragraph of your essay. Set up the question you are answering and why it matters.",
      },
      { type: "heading", text: "Start With Failures" },
      {
        type: "text",
        body: "Body text. Add as many paragraphs, lists, code snippets and media as you like.",
      },
      {
        type: "media",
        count: 3,
        caption: "Charts, slides or a short video — any number, any format.",
      },
      {
        type: "quote",
        text: "Measure what users actually ask, not what is easy to measure.",
        cite: "Field note",
      },
    ],
  },
  {
    slug: "notes-on-agents",
    title: "Notes on Building Reliable Agents",
    dek: "Guardrails, tool design and the boring engineering that makes agents trustworthy.",
    date: "2026-08-03",
    readTime: "6 min read",
    tags: ["Agents", "LLMs"],
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
    blocks: [
      { type: "text", body: "Write your post here." },
      { type: "media", caption: "Attach a diagram, PDF or recording." },
    ],
  },
];

export const experience: ExperiencePageContent = {
  kind: "experience",
  entries: [
    {
      id: "exp-ai-engineer",
      role: "AI Engineer",
      org: "Company Name",
      employmentType: "full-time",
      location: "Remote",
      workMode: "remote",
      startDate: "2024-01-01",
      current: true,
      period: "2024 — Present",
      overview: "Designing and building applied AI systems.",
      responsibilities: [
        "Shipped an LLM assistant used by 10k people.",
        "Built the evaluation pipeline.",
      ],
      achievements: ["Reduced hallucination rate by 40%", "Cut median latency to under 1.2s"],
      tech: ["Python", "LangChain", "pgvector", "OpenAI", "FastAPI"],
      skillIds: ["skill-prompt-tool-design", "skill-agents", "skill-rag"],
      visible: true,
      sort: 0,
      blocks: [
        {
          type: "list",
          items: ["Shipped an LLM assistant used by 10k people.", "Built the evaluation pipeline."],
        },
      ],
    },
    {
      id: "exp-software-engineer",
      role: "Software Engineer",
      org: "Previous Company",
      employmentType: "full-time",
      location: "City, Country",
      workMode: "on-site",
      startDate: "2021-01-01",
      endDate: "2023-12-31",
      period: "2021 — 2024",
      overview: "Short description of responsibilities and impact.",
      responsibilities: ["Built internal tooling and APIs."],
      tech: ["TypeScript", "Postgres", "Docker"],
      visible: true,
      sort: 1,
      blocks: [{ type: "text", body: "Short description of responsibilities and impact." }],
    },
  ],
};
