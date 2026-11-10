/* eslint-disable @typescript-eslint/no-explicit-any */
// Blog search: PostgreSQL full-text search (title A / dek+tags B / body C)
// with pg_trgm fuzzy fallback for typos. Drafts, scheduled and private posts
// are excluded inside the RPC, never here.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Search, X } from "lucide-react";
import { searchPosts, searchSuggest, getBlogTags } from "@/lib/server-fns";

export const Route = createFileRoute("/blog/search")({
  component: SearchPage,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function SearchPage() {
  const search = Route.useSearch() as any;
  const [query, setQuery] = useState(String(search.q ?? ""));
  const [tag, setTag] = useState(String(search.tag ?? ""));
  const [year, setYear] = useState<string | number>(search.year ?? "");
  const [featured, setFeatured] = useState<boolean | null>(
    search.featured === "true" ? true : search.featured === "false" ? false : null,
  );
  const [sort, setSort] = useState<"relevance" | "newest" | "oldest">(
    (search.sort as any) ?? "relevance",
  );
  const [page, setPage] = useState(Math.max(1, Number(search.page ?? 1)));
  const [perPage] = useState(10);

  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<{ kind: string; label: string; slug: string }[]>(
    [],
  );
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<number | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (query) p["q"] = query;
    if (tag) p["tag"] = tag;
    if (year) p["year"] = String(year);
    if (featured !== null) p["featured"] = featured ? "true" : "false";
    p["sort"] = sort;
    p["page"] = String(page);
    p["perPage"] = String(perPage);
    return p;
  }, [query, tag, year, featured, sort, page]);

  useEffect(() => {
    if (query.trim()) {
      void runSearch();
    } else {
      setResults([]);
      setTotal(0);
      setError(null);
    }
  }, [query, tag, year, featured, sort, page]);

  useEffect(() => {
    (getBlogTags as any)()
      .then((rows: any) => setTags(rows))
      .catch(() => {});
  }, []);

  const runSearch = async () => {
    setError(null);
    setLoading(true);
    try {
      const data: any = await (searchPosts as any)({
        data: {
          query: query.trim() || null,
          tag: tag || null,
          year: year ? Number(year) : null,
          featured: featured === null ? null : featured,
          sort,
          page,
          perPage,
        },
      });
      setResults(data.posts ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      setError(e?.message ?? "Search failed.");
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const onSuggest = async () => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    suggestTimer.current = window.setTimeout(async () => {
      try {
        const rows: any[] = await (searchSuggest as any)({ data: { query: q, limit: 6 } });
        setSuggestions(rows);
        setShowSuggestions(rows.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  };

  useEffect(() => {
    if (query.trim().length >= 2) void onSuggest();
    else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    return () => {
      if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleSelect = (suggestion: { kind: string; label: string; slug: string }) => {
    setShowSuggestions(false);
    if (suggestion.kind === "post" && suggestion.slug) {
      window.location.href = `/blog/${suggestion.slug}`;
    } else if (suggestion.kind === "tag") {
      setTag(suggestion.label);
      setPage(1);
    }
  };

  if (loading && results.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
      </div>
    );
  }

  const hasResults = results.length > 0;
  const showingQuery = query.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">
            {showingQuery ? `Search results for “${escapeHtml(showingQuery)}”` : "Search"}
          </h1>
          {total && (
            <p className="text-sm text-muted-foreground">
              {total} result{total === 1 ? "" : "s"} found.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1 min-w-[20rem]">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search articles…"
            className={`${field} pl-8`}
          />
          <button
            type="button"
            onClick={() => setQuery("")}
            disabled={!query.trim()}
            className={`absolute right-2 top-2.5 h-5 w-5 text-muted-foreground ${!query.trim() ? "opacity-0" : ""}`}
          >
            <X className="h-4 w-4" />
          </button>
        </label>
        {showingQuery && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            Clear
          </button>
        )}
      </div>

      {showingQuery && suggestions.length > 0 && showSuggestions && (
        <div className="border border-border bg-background z-20 w-[20rem]">
          <div className="border-b border-border px-3 py-1 text-xs text-muted-foreground uppercase tracking-wide">
            Suggestions
          </div>
          {suggestions.map((s) => (
            <button
              key={`${s.kind}-${s.slug ?? s.label}`}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              {s.kind === "post" ? (
                <span className="font-medium">{escapeHtml(s.label)}</span>
              ) : (
                `# ${escapeHtml(s.label)}`
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border border-border bg-muted/30 p-3">
        <label className="text-xs text-muted-foreground">Tag</label>
        <select
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setPage(1);
          }}
          className={`${field} w-auto`}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.tag} value={t.tag}>
              #{t.tag} ({t.count})
            </option>
          ))}
        </select>
        <select
          value={String(year)}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
          className={`${field} w-auto`}
        >
          <option value="">Any year</option>
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={featured === true}
            onChange={(e) => {
              setFeatured(e.target.checked);
              setPage(1);
            }}
          />
          Featured only
        </label>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as any);
            setPage(1);
          }}
          className={`${field} w-auto`}
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!showingQuery && !tag && !year && featured === null ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border py-24 text-center text-muted-foreground">
          <Search className="h-10 w-10" />
          <p>Enter a search term to find articles.</p>
        </div>
      ) : hasResults ? (
        <div className="space-y-4">
          {results.map((post) => (
            <article
              key={post.slug}
              className="border border-border rounded-lg p-5 hover:bg-muted/30 transition-colors"
            >
              <Link to="/blog/$slug" params={{ slug: post.slug }} className="block">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {(post.tags as string[]).slice(0, 4).map((t: string) => (
                    <span
                      key={t}
                      className="text-[10px] uppercase tracking-wider text-link font-sans hover:underline"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <h2 className="font-display text-xl leading-tight text-foreground group-hover:underline">
                  {post.title}
                </h2>
                <p className="mt-1 font-serif text-muted-foreground">{post.dek || "No excerpt."}</p>
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  {post.date} {post.readTime ? `· ${post.readTime}` : ""}
                  {post.author ? `· ${post.author}` : ""}
                </p>
                {post.headline && <p className="mt-2 text-sm text-foreground">{post.headline}</p>}
              </Link>
            </article>
          ))}
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-link hover:underline disabled:opacity-40"
              >
                ← Newer
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-link hover:underline disabled:opacity-40"
              >
                Older →
              </button>
            </nav>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border py-24 text-center text-muted-foreground">
          <Search className="h-10 w-10" />
          <p>No articles match your search.</p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
