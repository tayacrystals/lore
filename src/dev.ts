import path from "node:path";
import { watch } from "node:fs";
import { stat } from "node:fs/promises";
import { build } from "./build.ts";
import { loadConfig } from "./config.ts";
import { getDefaultVersion } from "./version.ts";
import { getDefaultLocale } from "./i18n.ts";

export async function dev(docsDir: string, outDir: string): Promise<void> {
  const port = 3000;

  // Load config for redirect logic
  const config = await loadConfig(docsDir);

  // Initial build
  await build(docsDir, outDir, { devMode: true });

  // SSE clients waiting for reload signals
  const sseClients = new Set<ReadableStreamDefaultController<string>>();

  function notifyReload() {
    for (const ctrl of sseClients) {
      try {
        ctrl.enqueue("data: reload\n\n");
      } catch {
        sseClients.delete(ctrl);
      }
    }
  }

  // Watch docs dir and rebuild on changes
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  watch(docsDir, { recursive: true }, (_event, filename) => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      console.log(`\n${filename} changed — rebuilding...`);
      try {
        await build(docsDir, outDir, { devMode: true });
        notifyReload();
      } catch (err) {
        console.error("Build error:", err);
      }
    }, 100);
  });

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

      // SSE endpoint for live reload
      if (url.pathname === "/_lore/reload") {
        let ctrl!: ReadableStreamDefaultController<string>;
        const stream = new ReadableStream<string>({
          start(c) {
            ctrl = c;
            sseClients.add(ctrl);
            ctrl.enqueue(": connected\n\n");
          },
          cancel() {
            sseClients.delete(ctrl);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }

      // Serve files from outDir
      let filePath = path.join(outDir, url.pathname);
      try {
        const s = await stat(filePath);
        if (s.isDirectory()) filePath = path.join(filePath, "index.html");
      } catch {
        filePath = path.join(outDir, url.pathname, "index.html");
      }

      const file = Bun.file(filePath);
      if (await file.exists()) return new Response(file);

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`\nDev server running at http://localhost:${port}`);
  console.log("Watching for changes...\n");
}
