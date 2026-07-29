import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { versioning } from '../src/index.ts'
import { buildGraph } from '@loredocs/lore'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lore-ver-'))
  mkdirSync(join(root, 'v1'), { recursive: true })
  mkdirSync(join(root, 'v2'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFile(path: string, content: string): void {
  writeFileSync(join(root, path), content)
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

async function load(plugin: LorePlugin, c: BuildContext): Promise<Page[]> {
  return (await plugin.load?.(c)) as Page[]
}

describe('versioning plugin', () => {
  test('generates versioned pages with prefixed IDs and URLs', async () => {
    writeFile('v1/index.mdx', '# V1 Home')
    writeFile('v1/guide.mdx', '# V1 Guide')
    writeFile('v2/index.mdx', '# V2 Home')
    writeFile('v2/guide.mdx', '# V2 Guide')

    const plugin = versioning({
      versions: [
        { dir: 'v1', label: '1.0' },
        { dir: 'v2', label: '2.0' },
      ],
    })
    const pages = await load(plugin, ctx({}))

    const v1Guide = pages.find((p) => p.id === 'v1/guide')!
    expect(v1Guide).toBeDefined()
    expect(v1Guide.url).toBe('/v1/guide')

    const v2Guide = pages.find((p) => p.id === 'v2/guide')!
    expect(v2Guide).toBeDefined()
    expect(v2Guide.url).toBe('/v2/guide')
  })

  test('always produces prefixed pages and redirects at root', async () => {
    writeFile('v1/index.mdx', '# V1 Home')
    writeFile('v1/guide.mdx', '# V1 Guide')
    writeFile('v2/index.mdx', '# V2 Home')
    writeFile('v2/guide.mdx', '# V2 Guide')

    const plugin = versioning({
      versions: [
        { dir: 'v1', label: '1.0' },
        { dir: 'v2', label: '2.0' },
      ],
      defaultVersion: 'v2',
    })
    const pages = await load(plugin, ctx({}))

    // All content pages are prefixed
    expect(pages.find((p) => p.id === 'guide')).toBeUndefined()
    const v2Guide = pages.find((p) => p.id === 'v2/guide')!
    expect(v2Guide).toBeDefined()
    expect(v2Guide.url).toBe('/v2/guide')

    // Root redirects to default version
    const index = pages.find((p) => p.id === 'index')!
    expect(index).toBeDefined()
    expect(index.url).toBe('/')
    expect(index.body).toContain('meta http-equiv="refresh"')
    expect(index.body).toContain('/v2/')
  })

  test('redirects to latest when no default version', async () => {
    writeFile('v1/index.mdx', '# V1 Home')
    writeFile('v2/index.mdx', '# V2 Home')

    const plugin = versioning({
      versions: [
        { dir: 'v1', label: '1.0' },
        { dir: 'v2', label: '2.0' },
      ],
    })
    const pages = await load(plugin, ctx({}))

    const index = pages.find((p) => p.id === 'index')!
    expect(index.body).toContain('/v2/')
  })

  test('version root pages have correct IDs', async () => {
    writeFile('v1/index.mdx', '# V1')
    writeFile('v2/index.mdx', '# V2')

    const plugin = versioning({
      versions: [
        { dir: 'v1', label: '1.0' },
        { dir: 'v2', label: '2.0' },
      ],
    })
    const pages = await load(plugin, ctx({}))

    const v1Root = pages.find((p) => p.id === 'v1/index')!
    expect(v1Root).toBeDefined()
    expect(v1Root.url).toBe('/v1/')

    const v2Root = pages.find((p) => p.id === 'v2/index')!
    expect(v2Root).toBeDefined()
    expect(v2Root.url).toBe('/v2/')
  })

  test('emits version manifest asset', async () => {
    writeFile('v1/index.mdx', '# V1')

    const plugin = versioning({
      versions: [{ dir: 'v1', label: '1.0' }, { dir: 'v2', label: '2.0' }],
      defaultVersion: 'v2',
    })
    const c = ctx({})
    await load(plugin, c)
    const assets = (await plugin.clientAssets?.(c)) ?? []
    const manifest = assets.find((a: { id: string }) => a.id === 'versioning:manifest')!
    expect(manifest).toBeDefined()
    const parsed = JSON.parse(manifest.content!)
    expect(parsed.versions).toHaveLength(2)
    expect(parsed.defaultVersion).toBe('v2')
  })

  test('integrates with content graph', async () => {
    writeFile('v1/index.mdx', '# V1 Home')
    writeFile('v1/guide.mdx', '# V1 Guide')
    writeFile('v2/index.mdx', '# V2 Home')
    writeFile('v2/guide.mdx', '# V2 Guide')

    const plugin = versioning({
      versions: [{ dir: 'v1', label: '1.0' }, { dir: 'v2', label: '2.0' }],
      defaultVersion: 'v2',
    })
    const pages = await load(plugin, ctx({}))
    const graph = buildGraph(pages)

    // Root is a redirect (no children)
    const rootPage = graph.pages.get('index')!
    expect(rootPage.synthetic).toBe(true)
    expect(rootPage.childIds).toEqual([])

    // v1 and v2 roots have their own children
    expect(graph.pages.get('v1/index')?.childIds).toContain('v1/guide')
    expect(graph.pages.get('v2/index')?.childIds).toContain('v2/guide')
  })

  test('custom urlPrefix overrides default', async () => {
    writeFile('v1/index.mdx', '# V1')

    const plugin = versioning({
      versions: [{ dir: 'v1', label: '1.0', urlPrefix: '/1.x' }],
    })
    const pages = await load(plugin, ctx({}))

    const v1Root = pages.find((p) => p.id === 'v1/index')!
    expect(v1Root.url).toBe('/1.x/')
  })
})
