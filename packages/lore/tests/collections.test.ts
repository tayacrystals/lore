import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { collections } from '@loredocs/plugin-collections'
import { buildGraph } from '@loredocs/lore'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lore-test-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeRoot(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

function ctx(config: Record<string, unknown>): BuildContext {
  return {
    command: 'build',
    root,
    outDir: join(root, 'dist'),
    config: { title: 'Test', basePath: '', ...config },
    graph: { pages: new Map(), rootIds: [] },
    plugins: [],
    components: {},
    assets: [],
  }
}

async function load(plugin: LorePlugin, ctx: BuildContext): Promise<Page[]> {
  return (await plugin.load?.(ctx)) as Page[]
}

const TEMPLATE = '# {{title}}\n\n{{body}}'

describe('collections plugin', () => {
  test('generates pages from JSON array', async () => {
    writeRoot('data.json', JSON.stringify([
      { title: 'Entry A', body: 'Alpha content' },
      { title: 'Entry B', body: 'Beta content' },
    ]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'entries', source: 'data.json', template: 'template.mdx' }] }))

    const entryPages = pages.filter((p) => !p.isSection)
    expect(entryPages).toHaveLength(2)
    expect(entryPages[0]?.title).toBe('Entry A')
    expect(entryPages[0]?.body).toContain('Alpha content')
    expect(entryPages[0]?.url).toBe('/entries/entry-a')
    expect(entryPages[0]?.parentId).toBe('entries')
  })

  test('generates an overview section page', async () => {
    writeRoot('data.json', JSON.stringify([
      { title: 'One', body: 'x' },
      { title: 'Two', body: 'y' },
    ]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'items', source: 'data.json', template: 'template.mdx' }] }))

    const overview = pages.find((p) => p.isSection)
    expect(overview).toBeDefined()
    expect(overview?.id).toBe('items')
    expect(overview?.url).toBe('/items')
    expect(overview?.childIds).toHaveLength(2)
    expect(overview?.body).toContain('/items/one')
    expect(overview?.body).toContain('/items/two')
  })

  test('interpolates custom title template', async () => {
    writeRoot('data.json', JSON.stringify([
      { name: 'Widget', version: '1.0' },
    ]))
    writeRoot('template.mdx', '# {{name}} v{{version}}')

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'pkg', source: 'data.json', template: 'template.mdx', title: '{{name}} v{{version}}' }] }))

    const entry = pages.find((p) => !p.isSection)!
    expect(entry.title).toBe('Widget v1.0')
    expect(entry.body).toContain('Widget v1.0')
  })

  test('hides entries from sidebar when hidden: true', async () => {
    writeRoot('data.json', JSON.stringify([{ title: 'Hidden', body: 'x' }]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'secret', source: 'data.json', template: 'template.mdx', hidden: true }] }))

    const entry = pages.find((p) => !p.isSection)!
    expect(entry.hidden).toBe(true)
  })

  test('entries visible by default', async () => {
    writeRoot('data.json', JSON.stringify([{ title: 'Visible', body: 'x' }]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'open', source: 'data.json', template: 'template.mdx' }] }))

    const entry = pages.find((p) => !p.isSection)!
    expect(entry.hidden).toBe(false)
  })

  test('sorts entries by specified field', async () => {
    writeRoot('data.json', JSON.stringify([
      { title: 'Zeta', date: '2025-03-01' },
      { title: 'Alpha', date: '2025-01-01' },
      { title: 'Mid', date: '2025-02-01' },
    ]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'sorted', source: 'data.json', template: 'template.mdx', sort: 'date' }] }))

    const entries = pages.filter((p) => !p.isSection)
    expect(entries[0]?.title).toBe('Alpha')
    expect(entries[1]?.title).toBe('Mid')
    expect(entries[2]?.title).toBe('Zeta')
  })

  test('handles empty JSON array', async () => {
    writeRoot('data.json', '[]')
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'empty', source: 'data.json', template: 'template.mdx' }] }))

    expect(pages).toHaveLength(1)
    expect(pages[0]?.isSection).toBe(true)
    expect(pages[0]?.body).toBe('')
  })

  test('leaves missing fields as placeholder', async () => {
    writeRoot('data.json', JSON.stringify([{ title: 'Partial' }]))
    writeRoot('template.mdx', '# {{title}}\n\n{{missing}}')

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'partial', source: 'data.json', template: 'template.mdx' }] }))

    const entry = pages.find((p) => !p.isSection)!
    expect(entry.body).toContain('{{missing}}')
  })

  test('paginates overview when perPage is set', async () => {
    const data = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i + 1}`, body: 'x' }))
    writeRoot('data.json', JSON.stringify(data))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'paged', source: 'data.json', template: 'template.mdx', perPage: 2 }] }))

    const overviews = pages.filter((p) => p.isSection || p.hidden && p.id.includes('page'))
    // Page 1 (section) + 2 pagination pages
    expect(overviews).toHaveLength(3)
    // First overview is the section with all children
    expect(overviews[0]?.id).toBe('paged')
    expect(overviews[0]?.childIds).toHaveLength(5)
    // Pagination links present in body
    expect(overviews[0]?.body).toContain('/paged/page/2')
    expect(overviews[0]?.body).toContain('/paged/page/3')
  })

  test('warns on missing JSON source', async () => {
    writeRoot('template.mdx', TEMPLATE)
    const warn = console.warn
    const warnings: string[] = []
    console.warn = (msg: string) => warnings.push(msg)

    const plugin = collections()
    await load(plugin, ctx({ collections: [{ name: 'missing', source: 'nope.json', template: 'template.mdx' }] }))

    console.warn = warn
    expect(warnings.some((w) => w.includes('JSON source not found'))).toBe(true)
  })

  test('warns on missing template', async () => {
    writeRoot('data.json', '[]')
    const warn = console.warn
    const warnings: string[] = []
    console.warn = (msg: string) => warnings.push(msg)

    const plugin = collections()
    await load(plugin, ctx({ collections: [{ name: 'missing', source: 'data.json', template: 'nope.mdx' }] }))

    console.warn = warn
    expect(warnings.some((w) => w.includes('template not found'))).toBe(true)
  })

  test('returns empty when no collections configured', async () => {
    const plugin = collections()
    const pages = await load(plugin, ctx({}))
    expect(pages).toHaveLength(0)
  })

  test('integrates with content graph', async () => {
    writeRoot('data.json', JSON.stringify([
      { title: 'Alpha', body: 'a' },
      { title: 'Beta', body: 'b' },
    ]))
    writeRoot('template.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({ collections: [{ name: 'docs', source: 'data.json', template: 'template.mdx' }] }))
    // Simulate the root index page that the filesystem plugin would create
    pages.unshift({ id: 'index', url: '/', title: 'Home', frontmatter: {}, body: '', isSection: false, order: 0, parentId: null, childIds: [] })
    const graph = buildGraph(pages)

    const section = graph.pages.get('docs')!
    expect(section.childIds).toHaveLength(2)
    expect(graph.rootIds).toContain('docs')
  })

  test('generates versioned collections when versioning is active', async () => {
    writeRoot('v1/_data/changelog.json', JSON.stringify([
      { title: 'V1 Release', body: 'first' },
    ]))
    writeRoot('v1/_data/entry.mdx', TEMPLATE)
    writeRoot('v2/_data/changelog.json', JSON.stringify([
      { title: 'V2 Release', body: 'second' },
    ]))
    writeRoot('v2/_data/entry.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({
      collections: [{ name: 'changelog', source: '_data/changelog.json', template: '_data/entry.mdx' }],
      versioning: { versions: [{ dir: 'v1', label: '1.0' }, { dir: 'v2', label: '2.0' }] },
    }))

    const v1Entry = pages.find((p) => p.id === 'v1/changelog/v1-release')!
    expect(v1Entry).toBeDefined()
    expect(v1Entry.url).toBe('/v1/changelog/v1-release')
    expect(v1Entry.parentId).toBe('v1/changelog')

    const v2Entry = pages.find((p) => p.id === 'v2/changelog/v2-release')!
    expect(v2Entry).toBeDefined()
    expect(v2Entry.url).toBe('/v2/changelog/v2-release')

    const v1Overview = pages.find((p) => p.id === 'v1/changelog')!
    expect(v1Overview).toBeDefined()
    expect(v1Overview.parentId).toBe('v1/index')
  })

  test('generates locale-scoped collections when i18n is active', async () => {
    writeRoot('en/_data/changelog.json', JSON.stringify([
      { title: 'Release', body: 'en content' },
    ]))
    writeRoot('en/_data/entry.mdx', TEMPLATE)
    writeRoot('fr/_data/changelog.json', JSON.stringify([
      { title: 'Sortie', body: 'fr content' },
    ]))
    writeRoot('fr/_data/entry.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({
      collections: [{ name: 'changelog', source: '_data/changelog.json', template: '_data/entry.mdx' }],
      i18n: { locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }] },
    }))

    const enEntry = pages.find((p) => p.id === 'en/changelog/release')!
    expect(enEntry).toBeDefined()
    expect(enEntry.url).toBe('/en/changelog/release')
    expect(enEntry.body).toContain('en content')

    const frEntry = pages.find((p) => p.id === 'fr/changelog/sortie')!
    expect(frEntry).toBeDefined()
    expect(frEntry.url).toBe('/fr/changelog/sortie')
    expect(frEntry.body).toContain('fr content')
  })

  test('generates locale+version scoped collections when both are active', async () => {
    writeRoot('en/v2/_data/changelog.json', JSON.stringify([
      { title: 'Release EN V2', body: 'content' },
    ]))
    writeRoot('en/v2/_data/entry.mdx', TEMPLATE)

    const plugin = collections()
    const pages = await load(plugin, ctx({
      collections: [{ name: 'changelog', source: '_data/changelog.json', template: '_data/entry.mdx' }],
      i18n: { locales: [{ code: 'en', label: 'English' }] },
      versioning: { versions: [{ dir: 'v2', label: '2.0' }] },
    }))

    const entry = pages.find((p) => p.id === 'en/v2/changelog/release-en-v2')!
    expect(entry).toBeDefined()
    expect(entry.url).toBe('/en/v2/changelog/release-en-v2')
    expect(entry.parentId).toBe('en/v2/changelog')

    const overview = pages.find((p) => p.id === 'en/v2/changelog')!
    expect(overview.parentId).toBe('en/v2/index')
  })
})
