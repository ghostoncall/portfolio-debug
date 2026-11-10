// Server-side Supabase client (Supabase Auth verification).
// Read-only cookie access: the browser client owns session writes.
// Import only from server code (server functions / server entry).

import { createServerClient } from "@supabase/ssr";

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        const name = part.trim();
        return name ? { name, value: "" } : null;
      }
      const name = part.slice(0, index).trim();
      const raw = part.slice(index + 1).trim();
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // Keep the raw value when it is not percent-encoded.
      }
      return name ? { name, value } : null;
    })
    .filter((cookie): cookie is { name: string; value: string } => cookie !== null);
}

export function getSupabaseServer(request: Request) {
  const url = (import.meta.env as any).VITE_SUPABASE_URL as string | undefined;
  const anonKey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get("cookie")),
      // Server-side verification never needs to refresh/write cookies.
      setAll: () => {},
    },
  });
}

/** Returns the authenticated Supabase user for this request, or null. */
export async function getAuthUser(request: Request) {
  try {
    const supabase = getSupabaseServer(request);
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const user = data.user;
    if (!user) return null;

    // Optional allowlist: when ADMIN_EMAIL is set, only that account may
    // enter /onlyme (prevents any other Supabase signup from getting in).
    const allowed = process.env["ADMIN_EMAIL"];
    if (allowed && (user.email ?? "").toLowerCase() !== allowed.toLowerCase()) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
