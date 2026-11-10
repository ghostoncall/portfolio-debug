/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getSiteIdentity } from "@/lib/server-fns";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export const Route = createFileRoute("/onlyme/login")({
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
  },
  component: Login,
});

function safeFrom(): string {
  if (typeof window === "undefined") return "/onlyme";
  const raw = new URLSearchParams(window.location.search).get("from");
  if (raw && raw.startsWith("/onlyme") && !raw.startsWith("/onlyme/login")) return raw;
  return "/onlyme";
}

function Login() {
  const { site } = Route.useLoaderData() as { site: any };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If a Supabase session already exists, skip the login form.
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowser();
      supabase.auth
        .getUser()
        .then(({ data }: any) => {
          if (data.user) window.location.href = safeFrom();
        })
        .catch(() => {
          // No session — stay on the login form.
        });
    } catch (err: any) {
      setError(err?.message ?? "Supabase Auth is not configured.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.location.href = safeFrom();
    } catch (err: any) {
      setError(err?.message ?? "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 font-sans pt-20">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage the portfolio.
          </p>
        </div>

        <div className="border border-border bg-card p-8 shadow-sm">
          {error && (
            <div className="mb-6 border border-destructive/30 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="ml-1 text-xs font-medium text-muted-foreground">Email</label>
              <div className="group relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="ml-1 text-xs font-medium text-muted-foreground">Password</label>
              <div className="group relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-input bg-background py-2 pl-10 pr-10 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="relative w-full overflow-hidden bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Authenticating…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <footer className="text-center">
        </footer>
      </div>
    </div>
  );
}
