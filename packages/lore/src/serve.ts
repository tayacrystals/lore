import { build } from './build.ts'
import { maybeCompress } from './compress.ts'
import { join, resolve } from 'node:path'
import { loadConfig, resolveOutDir } from './config.ts'

/** Static MIME types for content-type headers. */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.yaml': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8',
}

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.')) || '.html'
  return MIME[ext] ?? 'application/octet-stream'
}

/**
 * `lore serve <dir> [--port N]` — serve the built static site.
 *
 * Reads the config from `<dir>/lore.yml` to locate the output directory
 * (default `dist`), then serves files as a plain static file server.
 * Pretty-URL pages (`page-name/index.html`) are served at `/page-name`.
 */
export async function serve(rootArg: string, port = 4173): Promise<void> {
  const root = resolve(process.cwd(), rootArg)
  const config = await loadConfig(root)
  const outDir = resolveOutDir(config)

  // Build the site first, then serve the result.
  await build(rootArg)

  Bun.serve({
    port,
    idleTimeout: 0,
    async fetch(req) {
      const basePath = config.basePath
      let path = new URL(req.url).pathname

      // Strip basePath prefix when hosting under a sub-path.
      if ((basePath && path.startsWith(`${basePath}/`)) || (basePath && path === basePath)) {
        path = path.slice(basePath.length) || '/'
      }

      // Strip trailing slash (but keep root)
      if (path !== '/') path = path.replace(/\/$/, '')

      // Try exact match, then pretty-URL (dir/index.html), then 404
      const candidates = [
        join(outDir, path),
        join(outDir, path, 'index.html'),
        join(outDir, `${path}.html`),
      ]

      for (const filePath of candidates) {
        const file = Bun.file(filePath)
        if (await file.exists()) {
          const res = new Response(file, {
            headers: { 'content-type': contentType(filePath) },
          })
          return maybeCompress(req, res)
        }
      }

      return new Response('Not found', { status: 404 })
    },
    error(error) {
      console.error('[lore] serve error:', error)
      return new Response('Internal error', { status: 500 })
    },
  })

  const rel = outDir.startsWith(process.cwd()) ? outDir.slice(process.cwd().length + 1) : outDir
  console.log(`[lore] serving ${rel}/ → http://localhost:${port}`)
}
