import { describe, expect, test, vi } from 'bun:test'
import { deadLinks } from '@loredocs/plugin-dead-links'
import type { BuildContext, Page } from '@loredocs/lore'
import { buildGraph } from '@loredocs/lore'

function page(overrides: Partial<Page> & { id: string }): Page {
  return {
    url: overrides.id === 'index' ? '/' : `/${overrides.id}`,
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

function ctx(pages: Page[]): BuildContext {
  const graph = buildGraph(pages)
  return {
    command: 'build',
    root: '/docs',
    outDir: '/dist',
    config: { title: 'Test', basePath: '' },
    graph,
    plugins: [],
    components: {},
    assets: [],
  }
}

const plugin = deadLinks()

describe('deadLinks plugin', () => {
  test('no warnings for valid links', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[home](/)' }),
      page({ id: 'guide', body: '[see guide](/guide)' }),
      page({ id: 'a/b', body: '[cross ref](/a/b)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
  test('no warnings for relative ./ sibling links', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[plugins](./plugins)' }),
      page({ id: 'plugins', body: '' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('warns on broken absolute link', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[broken](/nonexistent)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('broken link')
    expect(warn.mock.calls[0]?.[0]).toContain('/nonexistent')
    warn.mockRestore()
  })

  test('warns on broken relative link', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[missing](./does-not-exist)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('does-not-exist')
    warn.mockRestore()
  })

  test('resolves relative links within subdirectories', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '' }),
      page({ id: 'guides', body: '', isSection: true, parentId: 'index' }),
      page({ id: 'guides/quick-start', body: '[api](../api/endpoint)', parentId: 'guides' }),
      page({ id: 'api', body: '', isSection: true, parentId: 'index' }),
      page({ id: 'api/endpoint', body: '', parentId: 'api' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('skips external URLs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[ext](https://example.com)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('skips mailto links', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[email](mailto:a@b.com)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('skips anchor-only links', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[jump](#section)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('skips images', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '![photo](./nonexistent.png)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('skips synthetic pages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[broken](/nope)', synthetic: true }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('handles links with fragments', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[with anchor](/guide#intro)' }),
      page({ id: 'guide', body: '' }),
    ]
    plugin.validate?.(ctx(pages))
    // Fragment resolution is not validated (would need rendered HTML)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('warns on broken link with fragment', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[broken](/nonexistent#heading)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('/nonexistent')
    warn.mockRestore()
  })

  test('warns on parent directory relative (..) from root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const pages = [
      page({ id: 'index', body: '[up](../nowhere)' }),
    ]
    plugin.validate?.(ctx(pages))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('nowhere')
    warn.mockRestore()
  })

})