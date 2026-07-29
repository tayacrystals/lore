import { parse } from 'yaml'
import { titleCase } from './config.ts'

const MD_EXTENSIONS = ['.mdx', '.md'] as const
export const INDEX_BASENAMES = new Set(['index', 'readme'])

export interface ParsedSource {
  frontmatter: Record<string, unknown>
  body: string
}

/** Split leading YAML frontmatter (`---\n…\n---`) from the body. */
export function parseFrontmatter(source: string): ParsedSource {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { frontmatter: {}, body: source }
  const raw = match[1] ?? ''
  const parsed = parse(raw)
  return {
    frontmatter: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
    body: source.slice(match[0].length),
  }
}

/** Strip a leading numeric ordering prefix (`01-`) and report its value. */
export function parseOrder(name: string): { base: string; order: number } {
  const match = name.match(/^(\d+)[-_](.+)$/)
  if (!match) return { base: name, order: Number.MAX_SAFE_INTEGER }
  return { base: match[2] ?? name, order: Number.parseInt(match[1] ?? '0', 10) }
}

export interface Slug {
  id: string
  url: string
}

/**
 * Convert a path relative to the docs root into a page id + url.
 *
 *   "index.mdx"             → { id: "index",        url: "/" }
 *   "guides/index.mdx"      → { id: "guides",       url: "/guides" }
 *   "guides/quick-start.mdx"→ { id: "guides/quick-start", url: "/guides/quick-start" }
 *   "01-intro.mdx"          → { id: "intro",        url: "/intro" }
 */
export function pathToSlug(relPath: string): Slug {
  const noPrefix = relPath.replace(/^\.\//, '')
  const parts = noPrefix.split('/').map((segment) => {
    const stripped = MD_EXTENSIONS.reduce((s, ext) => s.replace(ext, ''), segment)
    return parseOrder(stripped).base.toLowerCase()
  })

  const last = parts[parts.length - 1]
  if (last && INDEX_BASENAMES.has(last)) parts.pop()

  const slug = parts.join('/')
  return { id: slug || 'index', url: slug ? `/${slug}` : '/' }
}

/** Decide a page title: frontmatter → leading h1 → slug → fallback. */
export function resolveTitle(opts: {
  frontmatter: Record<string, unknown>
  body: string
  lastSegment?: string
  fallback: string
}): string {
  const fmTitle = opts.frontmatter.title
  if (typeof fmTitle === 'string' && fmTitle.trim()) return fmTitle.trim()

  const h1 = opts.body.match(/^#\s+(.+?)\s*$/m)
  if (h1?.[1]) return h1[1].trim()

  if (opts.lastSegment) return titleCase(opts.lastSegment)
  return opts.fallback
}

/** Is `name` a hidden/underscore-prefixed entry (excluded from the sidebar)? */
export function isHiddenName(name: string): boolean {
  return name.startsWith('_') || name.startsWith('.')
}

/** Is `name` an MDX/MD source file? */
export function isMarkdownFile(name: string): boolean {
  return MD_EXTENSIONS.some((ext) => name.endsWith(ext))
}
/** Convert a string to a URL-safe slug: lowercase, non-alphanumerics → hyphens, collapse. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
