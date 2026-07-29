import type { ContentGraph, Page } from './types.ts'

/** Root page id (the landing page served at `/`). */
export const ROOT_ID = 'index'

/**
 * Assemble a content graph from a flat list of pages (each carrying its
 * `parentId`). Wires `childIds`, sorts siblings by `(order, title)`, and
 * exposes `rootIds` (the root page's children = sidebar top level).
 */
export function buildGraph(pages: Page[]): ContentGraph {
  const map = new Map<string, Page>()
  for (const page of pages) map.set(page.id, page)

  for (const page of map.values()) page.childIds = []
  for (const page of map.values()) {
    if (page.parentId === null) continue
    map.get(page.parentId)?.childIds.push(page.id)
  }
  for (const page of map.values()) sortChildren(page, map)

  const root = map.get(ROOT_ID)
  return {
    pages: map,
    rootIds: root ? [...root.childIds] : topLevelIds(pages),
  }
}

/** Ordered siblings of a page (resolved from the graph). */
export function siblingsOf(graph: ContentGraph, page: Page): Page[] {
  const ids =
    page.parentId === null ? graph.rootIds : (graph.pages.get(page.parentId)?.childIds ?? [])
  return ids.map((id) => graph.pages.get(id)).filter((p): p is Page => !!p)
}

/** The previous/next pages in reading order within the same section. */
export function prevNext(graph: ContentGraph, page: Page): { prev?: Page; next?: Page } {
  const sibs = siblingsOf(graph, page)
  const i = sibs.findIndex((s) => s.id === page.id)
  return { prev: sibs[i - 1], next: sibs[i + 1] }
}

/** Breadcrumb pages from root down to `page` (inclusive). */
export function breadcrumbs(graph: ContentGraph, page: Page): Page[] {
  const chain: Page[] = []
  let cursor: Page | undefined = page
  while (cursor) {
    chain.unshift(cursor)
    cursor = cursor.parentId ? graph.pages.get(cursor.parentId) : undefined
  }
  return chain
}

/** Find a page by its output URL (the graph is keyed by id, not url). */
export function findPageByUrl(graph: ContentGraph, url: string): Page | undefined {
  for (const page of graph.pages.values()) {
    if (page.url === url) return page
  }
  return undefined
}

function sortChildren(page: Page, map: Map<string, Page>): void {
  const sorted = page.childIds
    .map((id) => map.get(id))
    .filter((p): p is Page => !!p)
    .sort(byOrderThenTitle)
  page.childIds = sorted.map((p) => p.id)
}

function topLevelIds(pages: Page[]): string[] {
  return pages
    .filter((p) => p.parentId === null)
    .sort(byOrderThenTitle)
    .map((p) => p.id)
}

function byOrderThenTitle(a: Page, b: Page): number {
  return a.order - b.order || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
}
