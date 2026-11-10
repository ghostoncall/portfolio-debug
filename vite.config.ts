/**
 * Owned Vite config — replaces the removed vendor wrapper package that used
 * to sit here. Composes the same standard plugins in the same order that
 * wrapper assembled, minus its editor-only plumbing (badge, telemetry,
 * devtools piping, sandbox shims, publishing manifest).
 * Server entry stays "server" (src/server.ts — SSR error wrapper) as before.
 */
import { loadEnv, mergeConfig } from "vite";
import { defineConfig, type ConfigEnv, type UserConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default ({ command, mode }: ConfigEnv): UserConfig => {
  // VITE_* env vars → import.meta.env define (same as the removed wrapper did).
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const isDevBuild = command === "build" && mode === "development";

  let config: UserConfig = {
    define: envDefine,
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect the bundled server entry to src/server.ts (SSR error wrapper).
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Build-time server bundling, same as the removed wrapper's default.
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      react(),
    ],
  };

  config = mergeConfig({ server: { host: "::", port: 8080 } }, config);
  config = mergeConfig(config, {
    server: { watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } } },
  });

  return config;
};
