import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Uploaded media lives in public/uploads/ at runtime. Serving it here keeps
// files created after a production build reachable, and avoids relying on
// Vite's static watcher in dev.
async function serveUpload(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/uploads/")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const name = pathname.slice("/uploads/".length);
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "public", "uploads", name);

  try {
    const data = await readFile(filePath);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const types: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      avif: "image/avif",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      pdf: "application/pdf",
    };
    return new Response(data, {
      headers: {
        "content-type": types[ext] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// Defense-in-depth: /onlyme pages must never render without a Supabase
// session, even if a client-side route guard is bypassed.
async function guardAdminArea(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const { pathname, search } = new URL(request.url);
  if (!pathname.startsWith("/onlyme")) return null;
  if (pathname === "/onlyme/login" || pathname.startsWith("/onlyme/login/")) return null;

  const { getAuthUser } = await import("./lib/supabase.server");
  const user = await getAuthUser(request);
  if (user) return null;

  const target = new URL("/onlyme/login", request.url);
  target.searchParams.set("from", `${pathname}${search}`);
  return Response.redirect(target, 302);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const uploadResponse = await serveUpload(request);
      if (uploadResponse) return uploadResponse;

      const guardResponse = await guardAdminArea(request);
      if (guardResponse) return guardResponse;

      const handler = await getServerEntry();
      // Inject the raw Request into server-function context so handlers can
      // access request headers (e.g. for session verification via `requireAdmin`).
      // TanStack Start passes `requestOpts.context` (the 2nd arg to `handler.fetch`)
      // straight to server-fn handlers; the runtime `env` never carries `request`.
      const envObj = env as Record<string, unknown> | undefined;
      const response = await handler.fetch(
        request,
        {
          ...envObj,
          context: {
            ...(envObj?.["context"] as Record<string, unknown>),
            request,
          },
        },
        ctx,
      );
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
