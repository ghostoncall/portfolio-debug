// Browser Supabase client (Supabase Auth).
// Uses cookie-backed sessions via @supabase/ssr so the server can verify them.

import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | null = null;

export function getSupabaseBrowser(): BrowserClient {
  if (client) return client;

  const url = (import.meta.env as any).VITE_SUPABASE_URL as string | undefined;
  const anonKey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}
