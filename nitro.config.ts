import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  devServer: { port: 8080 },
  serverDir: "server",
  routeRules: {
    "/rss.xml": { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
    "/sitemap.xml": { headers: { "content-type": "application/xml; charset=utf-8" } },
  },
});
