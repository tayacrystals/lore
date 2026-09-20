import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { readAsset } from './asset.ts'
import { loadConfig, resolveOutDir } from './config.ts'
import { collectContextAssets, createContext, runLoad, runValidate } from './pipeline.ts'
import { resolvePlugins } from './plugin-loader.ts'
import { renderPageHtml } from './render.tsx'
import { isHiddenName, isMarkdownFile } from './util.ts'

const SKIP_ENTRIES = new Set(['node_modules', 'dist', '.git', 'build', 'coverage'])
const SKIP_FILES = new Set(['lore.yml', 'lore.yaml', 'lore.json'])

/** `lore build <dir>` — render the site to static files in `dist/`. */
export async function build(rootArg: string): Promise<void> {
  const root = resolve(process.cwd(), rootArg)
  const config = await loadConfig(root)
  const outDir = resolveOutDir(config)
  const plugins = await resolvePlugins(config.plugins ?? [], root, config)

  const start = performance.now()

  const ctx = await createContext({ command: 'build', root, outDir, config, plugins })
  await runLoad(ctx)
  await runValidate(ctx)
  await collectContextAssets(ctx)

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await copyStatic(root, outDir)

  const shouldMinify = config.minify !== false

  for (const asset of ctx.assets) {
    if (asset.inline || !asset.url) continue
    const filePath = urlToPath(outDir, asset.url)
    await mkdir(dirname(filePath), { recursive: true })
    let content = await readAsset(asset)
    if (shouldMinify) content = await minifyAsset(content, asset.kind)
    await Bun.write(filePath, content)
  }

  // Minify inline asset content (used inside HTML <style>/<script> tags).
  if (shouldMinify) {
    for (const asset of ctx.assets) {
      if (!asset.inline) continue
      if (asset.kind === 'style' || asset.kind === 'script') {
        asset.content = await minifyAsset(asset.content ?? '', asset.kind)
      }
    }
  }

  let count = 0
  for (const page of ctx.graph.pages.values()) {
    let html = await renderPageHtml(page, ctx)
    if (shouldMinify) html = minifyHtml(html)
    const filePath = htmlPathFor(outDir, page.url)
    await mkdir(dirname(filePath), { recursive: true })
    await Bun.write(filePath, html)
    count++
  }

  const elapsed = performance.now() - start
  const size = await dirSize(outDir)

  const rel = relative(process.cwd(), outDir) || '.'
  console.log(
    `[lore] built ${count} pages into ${rel}/ (${formatSize(size)}, ${formatDuration(elapsed)})`,
  )
}


function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return i === 0 ? `${bytes}B` : `${size.toFixed(1)} ${units[i]}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
/** Recursively compute the total byte size of a directory. */
async function dirSize(dir: string): Promise<number> {
  let total = 0
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await dirSize(abs)
    } else if (entry.isFile()) {
      total += (await Bun.file(abs).stat()).size
    }
  }
  return total
}

/** Lightweight HTML minifier. Strips comments, collapses whitespace, minifies inline style/script. */
function minifyHtml(html: string): string {
  // Split on <pre> blocks — whitespace inside them is significant (code content)
  const parts = html.split(/(<pre\b[^>]*>[\s\S]*?<\/pre>)/i)
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i]
    if (part !== undefined) parts[i] = minifyFragment(part)
  }
  return parts.join('')
}

/** Minify an HTML fragment that contains no `<pre>` blocks. */
function minifyFragment(html: string): string {
  // Strip HTML comments (but not SSI/IE conditional comments)
  html = html.replace(/<!--[\s\S]*?-->/g, '')
  // Collapse whitespace between tags — safe for block elements, protected by <pre> split
  html = html.replace(/>\s+</g, '><')
  // Collapse runs of whitespace within text
  html = html.replace(/\s{2,}/g, ' ')
  return html.trim()
}

/** Minify an asset's content based on its kind. */
async function minifyAsset(
  content: string,
  kind: 'style' | 'script' | 'resource',
): Promise<string> {
  if (!content) return content
  if (kind === 'style') return minifyCss(content)
  if (kind === 'script') {
    const transpiler = new Bun.Transpiler({ loader: 'js', target: 'browser', minify: true } as never)
    return transpiler.transformSync(content)
  }
  return content
}

/** Simple CSS minifier. Preserves string literals and license comments. */
function minifyCss(css: string): string {
  let out = ''
  let i = 0
  let pendingSpace = false // whitespace seen, not yet emitted
  let suppressSpace = false // a delimiter was just emitted — no space before next token
  const n = css.length

  while (i < n) {
    const c = css[i]!

    // Comments: keep /*! … */ license banners, drop the rest.
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      if (css[i + 2] === '!') out += css.slice(i, stop)
      i = stop
      pendingSpace = true
      continue
    }

    // String literals: copy verbatim, whitespace and delimiters inside are significant.
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        if (css[j] === '\\') {
          j += 2
          continue
        }
        if (css[j] === c) {
          j++
          break
        }
        j++
      }
      out += css.slice(i, j)
      i = j
      pendingSpace = false
      suppressSpace = false
      continue
    }

    // Delimiters: trim whitespace on both sides, never insert any.
    if (c === '{' || c === '}' || c === ';' || c === ',' || c === ':') {
      // Drop a trailing ";" right before "}".
      if (c === '}' && out.endsWith(';')) out = out.slice(0, -1)
      out = out.replace(/\s+$/, '')
      out += c
      pendingSpace = false
      suppressSpace = true
      i++
      continue
    }

    if (/\s/.test(c)) {
      pendingSpace = true
      i++
      continue
    }

    if (pendingSpace && !suppressSpace) out += ' '
    pendingSpace = false
    suppressSpace = false
    out += c
    i++
  }

  return out.trim()
}
/** Copy non-markdown, non-config static files (images, logos, etc.) to dist. */
async function copyStatic(srcDir: string, destDir: string, base = ''): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_ENTRIES.has(entry.name) || isHiddenName(entry.name)) continue
    const destPath = join(destDir, base, entry.name)
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true })
      await copyStatic(join(srcDir, entry.name), destDir, join(base, entry.name))
    } else if (entry.isFile() && !isMarkdownFile(entry.name) && !SKIP_FILES.has(entry.name)) {
      await mkdir(dirname(destPath), { recursive: true })
      await Bun.write(destPath, Bun.file(join(srcDir, entry.name)))
    }
  }
}


function urlToPath(outDir: string, url: string): string {
  return join(outDir, url.replace(/^\//, ''))
}

function htmlPathFor(outDir: string, url: string): string {
  if (url === '/') return join(outDir, 'index.html')
  return join(outDir, url, 'index.html')
}
