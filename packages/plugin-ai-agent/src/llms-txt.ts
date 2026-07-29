/**
 * `llms.txt` generation.
 *
 * Builds a structured markdown index of every page in the content graph,
 * organized by section hierarchy. Each entry links to the `.md` version
 * of the page (not the HTML version), since the `.md` version is what
 * AI agents should consume.
 */

import type { BuildContext, Page } from '@loredocs/lore'

/**
 * Build `llms.txt` — a markdown index of all pages with titles, descriptions,
 * and links to `.md` versions, organized by the content graph's section hierarchy.
 */
export function buildLlmsTxt(
  pages: Page[],
  ctx: BuildContext,
  includeHidden: boolean,
): string {
  const title = ctx.config.title ?? 'Documentation'
  const desc = ctx.config.description ?? ''
  const lines: string[] = []

  lines.push(`# ${title}`)
  if (desc) lines.push('', `> ${desc}`)
  lines.push('')

  // Build a lookup for ids and parent→children mapping
  const byId = new Map(pages.map((p) => [p.id, p]))
  const childrenOf = new Map<string, Page[]>()
  for (const page of pages) {
    if (page.hidden && !includeHidden) continue
    if (page.synthetic && !page.body.trim() && !page.description) continue
    const key = page.parentId ?? ''
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key)!.push(page)
  }

  const seen = new Set<string>()

  // Emit each top-level page as a section heading with its children
  for (const rootId of ctx.graph.rootIds) {
    const page = byId.get(rootId)
    if (!page || (page.hidden && !includeHidden)) continue
    if (seen.has(page.id)) continue
    seen.add(page.id)

    const mdUrl = page.url === '/' ? '/index.md' : `${page.url}.md`
    const pageDesc = page.description ? `: ${page.description}` : ''
    lines.push(`## ${page.title}`)
    lines.push('')
    lines.push(`- [${page.title}](${mdUrl})${pageDesc}`)

    // List children indented under the section
    renderChildren(page.id, childrenOf, seen, lines, includeHidden, 1)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function renderChildren(
  parentId: string,
  childrenOf: Map<string, Page[]>,
  seen: Set<string>,
  lines: string[],
  includeHidden: boolean,
  depth: number,
): void {
  const kids = childrenOf.get(parentId) ?? []
  for (const page of kids) {
    if (page.hidden && !includeHidden) continue
    if (seen.has(page.id)) continue
    seen.add(page.id)

    const indent = '  '.repeat(depth)
    const mdUrl = page.url === '/' ? '/index.md' : `${page.url}.md`
    const pageDesc = page.description ? `: ${page.description}` : ''
    lines.push(`${indent}- [${page.title}](${mdUrl})${pageDesc}`)

    renderChildren(page.id, childrenOf, seen, lines, includeHidden, depth + 1)
  }
}
