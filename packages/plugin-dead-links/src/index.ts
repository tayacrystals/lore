import type { LorePlugin, Page } from '@loredocs/lore'

/**
 * Validates internal links across all pages at build time.
 *
 * Extracts markdown links `[text](href)` from each page's raw MDX body,
 * resolves them against the content graph, and emits warnings for any
 * that don't match a known page.
 *
 * External URLs, email links, anchor-only links, and images are skipped.
 */
export function deadLinks(): LorePlugin {
  return {
    name: 'lore:dead-links',
    validate(ctx) {
      const pages = [...ctx.graph.pages.values()]
      const urlSet = new Set(pages.map((p) => p.url))
      const idSet = new Set(pages.map((p) => p.id))

      for (const page of pages) {
        if (page.synthetic) continue
        for (const href of extractLinks(page.body)) {
          const issue = diagnose(href, page, urlSet, idSet)
          if (issue) {
            console.warn(`[lore:dead-links] ${page.sourcePath ?? page.id}: ${issue}`)
          }
        }
      }
    },
  }
}

// --- link extraction --------------------------------------------------------

/** Regex matching markdown links `[text](href)`. Lookbehind skips images. */
const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g

function extractLinks(body: string): string[] {
  const hrefs: string[] = []
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = LINK_RE.exec(body)) !== null) {
    const href = (m[1] ?? '').trim()
    if (href) hrefs.push(href)
  }
  return hrefs
}

// --- resolution -------------------------------------------------------------

const EXTERNAL_RE = /^\w+:\//
const EMAIL_RE = /^mailto:/i
const ANCHOR_ONLY_RE = /^#/

function diagnose(
  href: string,
  source: Page,
  urlSet: Set<string>,
  idSet: Set<string>,
): string | null {
  if (EXTERNAL_RE.test(href) || EMAIL_RE.test(href) || ANCHOR_ONLY_RE.test(href)) {
    return null
  }

  const hashIdx = href.indexOf('#')
  const path = hashIdx === -1 ? href : (href.slice(0, hashIdx) || '/')

  // Resolve relative path against the source page's id.
  // Handles `./`, `../`, and bare segment paths.
  const resolved = path.startsWith('/')
    ? path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    : (() => {
        const baseDir = source.id.includes('/') ? source.id.slice(0, source.id.lastIndexOf('/')) : ''
        const parts = baseDir ? baseDir.split('/') : []
        for (const segment of path.split('/')) {
          if (segment === '..') parts.pop()
          else if (segment !== '.' && segment !== '') parts.push(segment)
        }
        return parts.join('/') || 'index'
      })()

  const target = resolved.startsWith('/') ? resolved : `/${resolved}`
  if (!urlSet.has(target) && !idSet.has(resolved)) {
    return `broken link: \`${href}\` → ${target} not found`
  }

  return null
}
