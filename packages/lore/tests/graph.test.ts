import { describe, expect, test } from 'bun:test'
import { breadcrumbs, buildGraph, findPageByUrl, prevNext, siblingsOf } from '@loredocs/lore'
import type { Page } from '@loredocs/lore'

function page(overrides: Partial<Page> & { id: string }): Page {
  return {
    url: `/${overrides.id}`,
    title: overrides.id,
    frontmatter: {},
    body: '',
    isSection: false,
    order: Number.MAX_SAFE_INTEGER,
    parentId: null,
    childIds: [],
    ...overrides,
  }
}

describe('buildGraph', () => {
  test('wires childIds from parentId', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'guides', parentId: 'index' }),
      page({ id: 'reference', parentId: 'index' }),
    ]
    const graph = buildGraph(pages)
    expect(graph.pages.get('index')?.childIds).toEqual(['guides', 'reference'])
  })

  test('sorts children by order then title', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'zzz', parentId: 'index', order: 10 }),
      page({ id: 'aaa', parentId: 'index', order: 5 }),
      page({ id: 'bbb', parentId: 'index', order: 5 }),
    ]
    const graph = buildGraph(pages)
    expect(graph.pages.get('index')?.childIds).toEqual(['aaa', 'bbb', 'zzz'])
  })

  test('rootIds comes from index children', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'intro', parentId: 'index', order: 1 }),
      page({ id: 'setup', parentId: 'index', order: 2 }),
    ]
    const graph = buildGraph(pages)
    expect(graph.rootIds).toEqual(['intro', 'setup'])
  })

  test('handles orphan pages without an index', () => {
    const pages = [page({ id: 'orphan' })]
    const graph = buildGraph(pages)
    expect(graph.rootIds).toEqual(['orphan'])
  })
  test('last registered page wins on duplicate id', () => {
    const pages = [
      page({ id: 'index', title: 'first', order: 1 }),
      page({ id: 'index', title: 'second', order: 2 }),
    ]
    const graph = buildGraph(pages)
    // buildGraph uses Map.set which overwrites; last wins
    expect(graph.pages.get('index')?.title).toBe('second')
  })
})
describe('siblingsOf', () => {
  test('returns siblings from rootIds for root-level pages', () => {
    const pages = [page({ id: 'a' }), page({ id: 'b' })]
    const graph = buildGraph(pages)
    const sibs = siblingsOf(graph, pages[0] as Page)
    expect(sibs).toHaveLength(2)
    expect(sibs.map((s) => s.id)).toEqual(['a', 'b'])
  })

  test('returns siblings from parent', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'a', parentId: 'index' }),
      page({ id: 'b', parentId: 'index' }),
    ]
    const graph = buildGraph(pages)
    const sibs = siblingsOf(graph, pages[1] as Page)
    expect(sibs.map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('prevNext', () => {
  test('prev and next within siblings', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'a', parentId: 'index', order: 1 }),
      page({ id: 'b', parentId: 'index', order: 2 }),
      page({ id: 'c', parentId: 'index', order: 3 }),
    ]
    const graph = buildGraph(pages)
    const { prev, next } = prevNext(graph, pages[2] as Page) // b
    expect(prev?.id).toBe('a')
    expect(next?.id).toBe('c')
  })

  test('first sibling has no prev', () => {
    const pages = [page({ id: 'index' }), page({ id: 'a', parentId: 'index', order: 1 })]
    const graph = buildGraph(pages)
    const { prev, next } = prevNext(graph, pages[1] as Page) // a
    expect(prev).toBeUndefined()
    expect(next).toBeUndefined()
  })

  test('last sibling has no next', () => {
    const pages = [page({ id: 'index' }), page({ id: 'a', parentId: 'index', order: 1 })]
    const graph = buildGraph(pages)
    const { prev } = prevNext(graph, pages[1] as Page) // a
    expect(prev).toBeUndefined()
  })
})

describe('breadcrumbs', () => {
  test('returns chain from root to page', () => {
    const pages = [
      page({ id: 'index' }),
      page({ id: 'guides', parentId: 'index' }),
      page({ id: 'guides/quick-start', parentId: 'guides' }),
    ]
    const graph = buildGraph(pages)
    const crumbs = breadcrumbs(graph, pages[2] as Page)
    expect(crumbs.map((c) => c.id)).toEqual(['index', 'guides', 'guides/quick-start'])
  })

  test('root page returns only itself', () => {
    const pages = [page({ id: 'index' })]
    const graph = buildGraph(pages)
    const crumbs = breadcrumbs(graph, pages[0] as Page)
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]?.id).toBe('index')
  })
})

describe('findPageByUrl', () => {
  test('finds page by output URL', () => {
    const pages = [page({ id: 'index' }), page({ id: 'guides/quick-start' })]
    const graph = buildGraph(pages)
    expect(findPageByUrl(graph, '/guides/quick-start')?.id).toBe('guides/quick-start')
  })

  test('returns undefined for missing URL', () => {
    const graph = buildGraph([page({ id: 'index' })])
    expect(findPageByUrl(graph, '/missing')).toBeUndefined()
  })
})
