import path from "node:path";
import { stat } from "node:fs/promises";
import { build } from "./build.ts";
import { loadConfig } from "./config.ts";
import { getDefaultVersion } from "./version.ts";
import { getDefaultLocale } from "./i18n.ts";

const STATIC_EXTS = new Set([".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"]);

export async function serve(docsDir: string, outDir: string, port = 3000): Promise<void> {
  const config = await loadConfig(docsDir);
  await build(docsDir, outDir);

  Bun.serve({
    port,
    idleTimeout: 0,
    async fetch(req) {
      const url = new URL(req.url);

      // Redirect from root to default version/locale
      if (url.pathname === "/") {
        const defaultLocale = config.internationalization
          ? getDefaultLocale(config)
          : undefined;
        const defaultVersion = config.versioning
          ? getDefaultVersion(config)
          : undefined;

        const redirectPathParts: string[] = [];
        if (defaultLocale) redirectPathParts.push(defaultLocale);
        if (defaultVersion) redirectPathParts.push(defaultVersion);

        if (redirectPathParts.length > 0) {
          const redirectPath = "/" + redirectPathParts.join("/") + "/";
          return Response.redirect(url.origin + redirectPath, 302);
        }
      }

      let filePath = path.join(outDir, url.pathname);
      try {
        const s = await stat(filePath);
        if (s.isDirectory()) filePath = path.join(filePath, "index.html");
      } catch {
        filePath = path.join(outDir, url.pathname, "index.html");
      }

      const file = Bun.file(filePath);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });

      const ext = path.extname(filePath).toLowerCase();
      const headers: Record<string, string> = {};

      if (STATIC_EXTS.has(ext)) {
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
      }

      const type = file.type;
      const acceptsGzip = req.headers.get("Accept-Encoding")?.includes("gzip") ?? false;
      if (acceptsGzip && (type.startsWith("text/") || type.includes("javascript"))) {
        const compressed = Bun.gzipSync(await file.bytes());
        headers["Content-Encoding"] = "gzip";
        headers["Content-Type"] = type;
        headers["Vary"] = "Accept-Encoding";
        return new Response(compressed, { headers });
      }

      return new Response(file, { headers });
    },
  });

  console.log(`\nServing build at http://localhost:${port}`);
}
