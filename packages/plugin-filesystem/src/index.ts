import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { ROOT_ID } from '@loredocs/lore'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'
import {
  INDEX_BASENAMES,
  isHiddenName,
  parseFrontmatter,
  parseOrder,
  pathToSlug,
  resolveTitle,
} from '@loredocs/lore'

export interface FilesystemOptions {
  /** Extensions treated as page sources. Defaults to mdx + md. */
  extensions?: string[]
  /** Walk a subdirectory of ctx.root instead of the root itself. */
  subDir?: string
  /** Prefix all page IDs (e.g. 'v1'). Root page becomes '{prefix}/index'. */
  idPrefix?: string
  /** Prefix all page URLs (e.g. '/v1'). Root page becomes '/v1/'. */
  urlPrefix?: string
  /** Paths (relative to the docs root) to exclude from the build. Matches exactly or as a prefix — "external" excludes the whole subtree. */
  exclude?: string[]
}

/**
 * The default content loader. Walks the docs root and emits one Page per
 * markdown file, plus a section Page per directory (its body comes from the
 * directory's `index.mdx`, or is left empty for a synthetic directory listing).
 *
 * Accepts `subDir`, `idPrefix`, and `urlPrefix` so other plugins (e.g.
 * versioning) can compose it to walk versioned subdirectories with prefixed IDs.
 */
export function filesystem(options?: FilesystemOptions): LorePlugin {
  const extensions = options?.extensions ?? ['.mdx', '.md']
  const subDir = options?.subDir
  const idPrefix = options?.idPrefix
  const urlPrefix = options?.urlPrefix ?? (idPrefix ? `/${idPrefix}` : undefined)

  return {
    name: 'lore:filesystem',
    async load(ctx) {
      const baseDir = subDir ? join(ctx.root, subDir) : ctx.root
      const exclude = options?.exclude ?? ((ctx.config as Record<string, unknown>).exclude as string[] | undefined) ?? []
      return walk(baseDir, null, ctx, extensions, baseDir, exclude, idPrefix, urlPrefix)
    },
  }
}

async function walk(
  dirAbs: string,
  parentId: string | null,
  ctx: BuildContext,
  extensions: string[],
  baseDir: string,
  exclude: string[],
  idPrefix?: string,
  urlPrefix?: string,
): Promise<Page[]> {
  const entries = await readSortedEntries(dirAbs)
  const pages: Page[] = []

  const self = await makeDirPage(dirAbs, parentId, ctx, baseDir, idPrefix, urlPrefix)
  pages.push(self)

  for (const entry of entries) {
    if (isIndexFile(entry.name)) continue
    if (entry.name === 'node_modules') continue
    if (isHiddenName(entry.name)) continue

    const abs = join(dirAbs, entry.name)
    const relPath = relative(baseDir, abs)
    if (isExcluded(relPath, exclude)) continue

    if (entry.isDirectory()) {
      pages.push(...(await walk(abs, self.id, ctx, extensions, baseDir, exclude, idPrefix, urlPrefix)))
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      pages.push(await makeFilePage(abs, self.id, ctx, baseDir, idPrefix, urlPrefix))
    }
  }
  return pages
}

function isExcluded(relPath: string, exclude: string[]): boolean {
  if (exclude.length === 0) return false
  return exclude.some((p) => {
    const pat = p.endsWith('/') ? p.slice(0, -1) : p
    return relPath === pat || relPath.startsWith(`${pat}/`)
  })
}

function prefixId(id: string, idPrefix?: string): string {
  if (!idPrefix) return id
  if (id === ROOT_ID) return `${idPrefix}/index`
  return `${idPrefix}/${id}`
}

function prefixUrl(url: string, urlPrefix?: string): string {
  if (!urlPrefix) return url
  if (url === '/') return `${urlPrefix}/`
  return `${urlPrefix}${url}`
}

async function makeDirPage(
  dirAbs: string,
  parentId: string | null,
  ctx: BuildContext,
  baseDir: string,
  idPrefix?: string,
  urlPrefix?: string,
): Promise<Page> {
  const isRoot = parentId === null
  const rawId = isRoot ? ROOT_ID : dirToId(dirAbs, baseDir)
  const rawUrl = rawId === ROOT_ID ? '/' : `/${rawId}`

  const indexPath = await findIndex(dirAbs)
  let body = ''
  let frontmatter: Record<string, unknown> = {}
  let sourcePath: string | undefined
  let title: string
  let synthetic = true

  if (indexPath) {
    sourcePath = indexPath
    synthetic = false
    const text = await Bun.file(indexPath).text()
    const parsed = parseFrontmatter(text)
    frontmatter = parsed.frontmatter
    body = parsed.body
    title = resolveTitle({
      frontmatter,
      body,
      lastSegment: undefined,
      fallback: 'Home',
    })
  } else {
    title = isRoot
      ? ctx.config.title
      : resolveTitle({
          frontmatter,
          body,
          lastSegment: lastSlugSegment(rawId),
          fallback: rawId,
        })
  }

  // Frontmatter `slug` overrides the directory-derived last segment
  const fmSlug = optionalString(frontmatter.slug)
  let pageId = rawId
  let pageUrl = rawUrl
  if (fmSlug && !isRoot) {
    const lastSlash = rawId.lastIndexOf('/')
    const parentPath = lastSlash >= 0 ? rawId.slice(0, lastSlash + 1) : ''
    pageId = parentPath + fmSlug
    pageUrl = `/${pageId}`
  }

  return {
    id: prefixId(pageId, idPrefix),
    url: prefixUrl(pageUrl, urlPrefix),
    title,
    description: optionalString(frontmatter.description),
    frontmatter,
    body,
    sourcePath,
    isSection: !isRoot,
    order: dirOrder(dirAbs, baseDir),
    parentId,
    childIds: [],
    hidden: Boolean(frontmatter.hidden),
    synthetic,
  }
}

async function makeFilePage(
  fileAbs: string,
  parentId: string,
  _ctx: BuildContext,
  baseDir: string,
  idPrefix?: string,
  urlPrefix?: string,
): Promise<Page> {
  const rel = relative(baseDir, fileAbs).split(sep).join('/')
  const slug = pathToSlug(rel)
  const text = await Bun.file(fileAbs).text()
  const parsed = parseFrontmatter(text)

  // Frontmatter `slug` overrides the filename-derived last segment
  const fmSlug = optionalString(parsed.frontmatter.slug)
  let pageId = slug.id
  let pageUrl = slug.url
  if (fmSlug) {
    const lastSlash = slug.id.lastIndexOf('/')
    const parentPath = lastSlash >= 0 ? slug.id.slice(0, lastSlash + 1) : ''
    pageId = parentPath + fmSlug
    pageUrl = pageId === 'index' ? '/' : `/${pageId}`
  }

  return {
    id: prefixId(pageId, idPrefix),
    url: prefixUrl(pageUrl, urlPrefix),
    title: resolveTitle({
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      lastSegment: lastSlugSegment(pageId),
      fallback: pageId,
    }),
    description: optionalString(parsed.frontmatter.description),
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    sourcePath: fileAbs,
    isSection: false,
    order: parseOrder(fileBase(fileAbs)).order,
    parentId,
    childIds: [],
    hidden: Boolean(parsed.frontmatter.hidden),
    synthetic: false,
  }
}

async function readSortedEntries(dirAbs: string) {
  const entries = await readdir(dirAbs, { withFileTypes: true })
  return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

async function findIndex(dirAbs: string): Promise<string | undefined> {
  const entries = await readdir(dirAbs, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && isIndexFile(entry.name)) return join(dirAbs, entry.name)
  }
  return undefined
}

function isIndexFile(name: string): boolean {
  return INDEX_BASENAMES.has(parseOrder(baseName(name)).base.toLowerCase())
}

function dirToId(dirAbs: string, baseDir: string): string {
  const rel = relative(baseDir, dirAbs).split(sep).join('/')
  return pathToSlug(`${rel}/index.mdx`).id
}

function dirOrder(dirAbs: string, baseDir: string): number {
  const rel = relative(baseDir, dirAbs).split(sep).join('/')
  const first = rel.split('/')[0] ?? rel
  return parseOrder(first).order
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function fileBase(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf(sep))
  return baseName(slash >= 0 ? path.slice(slash + 1) : path)
}

function lastSlugSegment(id: string): string {
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
