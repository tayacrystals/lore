import { watch } from 'node:fs'
import { join, resolve } from 'node:path'
import { indexByUrl, readAsset } from './asset.ts'
import { loadConfig, resolveOutDir } from './config.ts'
import { findPageByUrl } from './graph.ts'
import { collectContextAssets, createContext, runLoad, runValidate } from './pipeline.ts'
import { renderPageHtml } from './render.tsx'
import { resolvePlugins } from './plugin-loader.ts'
import type { BuildContext } from './types.ts'
import { maybeCompress } from './compress.ts'

const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
let debounce: NodeJS.Timeout | undefined

/** `lore dev <dir>` — serve the site with live reload on file changes. */
export async function dev(rootArg: string, port = 5173): Promise<void> {
  const root = resolve(process.cwd(), rootArg)
  const config = await loadConfig(root)
  const outDir = resolveOutDir(config)
  const plugins = await resolvePlugins(config.plugins ?? [], root, config)
  const ctx = await createContext({ command: 'dev', root, outDir, config, plugins })

  await rebuild(ctx)
  await runValidate(ctx)

  watchSite(root, () => scheduleRebuild(ctx))

  Bun.serve({
    port,
    idleTimeout: 0,
    fetch(req) {
      return handle(req, ctx)
    },
    error(error) {
      console.error('[lore] request error:', error)
      return new Response('Internal error', { status: 500 })
    },
  })

  console.log(`[lore] dev server → http://localhost:${port} (root: ${rootArg})`)
}

async function rebuild(ctx: BuildContext): Promise<void> {
  await runLoad(ctx)
  await collectContextAssets(ctx)
}

function scheduleRebuild(ctx: BuildContext): void {
  clearTimeout(debounce)
  debounce = setTimeout(async () => {
    try {
      await rebuild(ctx)
      broadcast('reload')
    } catch (error) {
      console.error('[lore] rebuild failed:', error)
    }
  }, 100)
}

function watchSite(root: string, onChange: () => void): void {
  try {
    const watcher = watch(root, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      // Ignore events from the output directory.
      if (/[\\/]dist([\\/]|$)/.test(filename)) return
      onChange()
    })
    watcher.on('error', () => {
      // Fall back to polling on platforms without recursive watching.
      setInterval(() => onChange(), 1000)
    })
  } catch {
    setInterval(() => onChange(), 1000)
  }
}

async function handle(req: Request, ctx: BuildContext): Promise<Response> {
  const basePath = ctx.config.basePath
  let path = new URL(req.url).pathname

  // Strip basePath prefix when hosting under a sub-path.
  if ((basePath && path.startsWith(`${basePath}/`)) || (basePath && path === basePath)) {
    path = path.slice(basePath.length) || '/'
  }

  if (path === '/__lore__/reload') {
    return _sseResponse()
  }

  if (path.startsWith('/__lore__/')) {
    const asset = indexByUrl(ctx.assets).get(path)
    if (asset) {
      const body = await readAsset(asset)
      const res = new Response(body, {
        headers: { 'content-type': contentType(path) },
      })
      return maybeCompress(req, res)
    }
  }

  const pageUrl = path === '/' ? '/' : path.replace(/\/$/, '')
  const page = findPageByUrl(ctx.graph, pageUrl)
  if (page) {
    try {
      const body = await renderPageHtml(page, ctx)
      const res = new Response(body, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
      return maybeCompress(req, res)
    } catch (error) {
      return errorResponse(error)
    }
  }

  // Static file from the docs root (images, logos, etc.).
  const response = await resolveStatic(ctx.root, path)
  if (response) {
    return maybeCompress(req, response)
  }
  return new Response('Not found', { status: 404 })
}

async function resolveStatic(root: string, path: string): Promise<Response | null> {
  const file = Bun.file(join(root, path))
  if (await file.exists()) {
    return new Response(file, { headers: { 'content-type': contentType(path) } })
  }
  return null
}

function _sseResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.add(controller)
    },
    cancel(controller) {
      clients.delete(controller)
    },
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
}

function broadcast(event: string): void {
  const payload = new TextEncoder().encode(`event: ${event}\ndata:\n\n`)
  for (const controller of clients) {
    try {
      controller.enqueue(payload)
    } catch {
      clients.delete(controller)
    }
  }
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  return new Response(`<pre>${escapeHtml(message)}</pre>`, {
    status: 500,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function contentType(path: string): string {
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (path.endsWith('.json')) return 'application/json; charset=utf-8'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.html')) return 'text/html; charset=utf-8'
  return 'application/octet-stream'
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}
