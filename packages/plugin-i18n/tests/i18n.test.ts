import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { i18n } from '../src/index.ts'
import { buildGraph } from '@loredocs/lore'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lore-i18n-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFile(path: string, content: string): void {
  // Create parent dirs as needed
  const dirs = path.split('/').slice(0, -1)
  let current = root
  for (const d of dirs) {
    current = join(current, d)
    mkdirSync(current, { recursive: true })
  }
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

describe('i18n plugin', () => {
  test('generates locale-prefixed pages', async () => {
    writeFile('en/index.mdx', '# Home')
    writeFile('en/guide.mdx', '# Guide EN')
    writeFile('fr/index.mdx', '# Accueil')
    writeFile('fr/guide.mdx', '# Guide FR')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const pages = await load(plugin, ctx({}))

    const enGuide = pages.find((p) => p.id === 'en/guide')!
    expect(enGuide).toBeDefined()
    expect(enGuide.url).toBe('/en/guide')

    const frGuide = pages.find((p) => p.id === 'fr/guide')!
    expect(frGuide).toBeDefined()
    expect(frGuide.url).toBe('/fr/guide')

    // No unprefixed pages — always prefixed
    expect(pages.find((p) => p.id === 'guide')).toBeUndefined()
  })

  test('root redirects to default locale', async () => {
    writeFile('en/index.mdx', '# Home')
    writeFile('fr/index.mdx', '# Accueil')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const pages = await load(plugin, ctx({}))

    const index = pages.find((p) => p.id === 'index')!
    expect(index).toBeDefined()
    expect(index.body).toContain('meta http-equiv="refresh"')
    expect(index.body).toContain('/en/')
  })

  test('i18n + versioning produces cross-product', async () => {
    writeFile('en/v1/index.mdx', '# EN V1')
    writeFile('en/v2/index.mdx', '# EN V2')
    writeFile('fr/v1/index.mdx', '# FR V1')
    writeFile('fr/v2/index.mdx', '# FR V2')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const c = ctx({
      versioning: {
        versions: [{ dir: 'v1', label: '1.0' }, { dir: 'v2', label: '2.0' }],
        defaultVersion: 'v2',
      },
    })
    const pages = await load(plugin, c)

    // All four locale×version combinations exist
    expect(pages.find((p) => p.id === 'en/v1/index')).toBeDefined()
    expect(pages.find((p) => p.id === 'en/v2/index')).toBeDefined()
    expect(pages.find((p) => p.id === 'fr/v1/index')).toBeDefined()
    expect(pages.find((p) => p.id === 'fr/v2/index')).toBeDefined()

    // URLs have lang before version
    expect(pages.find((p) => p.id === 'fr/v1/index')?.url).toBe('/fr/v1/')
    expect(pages.find((p) => p.id === 'en/v2/index')?.url).toBe('/en/v2/')

    // Root redirects to default locale + default version
    const index = pages.find((p) => p.id === 'index')!
    expect(index.body).toContain('/en/v2/')
  })

  test('custom locale dir maps correctly', async () => {
    writeFile('zh/index.mdx', '# 首页')

    const plugin = i18n({
      locales: [{ code: 'zh-cn', label: '中文', dir: 'zh' }],
      defaultLocale: 'zh-cn',
    })
    const pages = await load(plugin, ctx({}))

    const zhPage = pages.find((p) => p.id === 'zh-cn/index')!
    expect(zhPage).toBeDefined()
    expect(zhPage.url).toBe('/zh-cn/')
  })

  test('emits locale manifest', async () => {
    writeFile('en/index.mdx', '# Home')
    writeFile('fr/index.mdx', '# Accueil')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const c = ctx({})
    await load(plugin, c)
    const assets = (await plugin.clientAssets?.(c)) ?? []
    const manifest = assets.find((a: { id: string }) => a.id === 'i18n:manifest')!
    expect(manifest).toBeDefined()
    const parsed = JSON.parse(manifest.content!)
    expect(parsed.locales).toHaveLength(2)
    expect(parsed.defaultLocale).toBe('en')
  })

  test('emits per-locale search indices', async () => {
    writeFile('en/guide.mdx', '# English Guide')
    writeFile('fr/guide.mdx', '# Guide Français')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const c = ctx({})
    const pages = await load(plugin, c)
    // Build graph so clientAssets can read it
    c.graph = buildGraph(pages)
    const assets = (await plugin.clientAssets?.(c)) ?? []

    const enIndex = assets.find((a: { id: string }) => a.id === 'i18n:search-en')!
    expect(enIndex).toBeDefined()
    const enEntries = JSON.parse(enIndex.content!)
    expect(enEntries.some((e: { title: string }) => e.title === 'English Guide')).toBe(true)

    const frIndex = assets.find((a: { id: string }) => a.id === 'i18n:search-fr')!
    expect(frIndex).toBeDefined()
    const frEntries = JSON.parse(frIndex.content!)
    expect(frEntries.some((e: { title: string }) => e.title === 'Guide Français')).toBe(true)
  })

  test('integrates with content graph', async () => {
    writeFile('en/index.mdx', '# Home')
    writeFile('en/guide.mdx', '# Guide')
    writeFile('fr/index.mdx', '# Accueil')
    writeFile('fr/guide.mdx', '# Guide FR')

    const plugin = i18n({
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
      defaultLocale: 'en',
    })
    const pages = await load(plugin, ctx({}))
    const graph = buildGraph(pages)

    // Root is a redirect (no children)
    expect(graph.pages.get('index')?.synthetic).toBe(true)

    // Each locale root has its own children
    expect(graph.pages.get('en/index')?.childIds).toContain('en/guide')
    expect(graph.pages.get('fr/index')?.childIds).toContain('fr/guide')
  })

  test('reads config from ctx.config.i18n', async () => {
    writeFile('en/index.mdx', '# Home')
    writeFile('ja/index.mdx', '# ホーム')

    const plugin = i18n()
    const pages = await load(plugin, ctx({
      i18n: {
        locales: [
          { code: 'en', label: 'English' },
          { code: 'ja', label: '日本語' },
        ],
        defaultLocale: 'en',
      },
    }))

    expect(pages.find((p) => p.id === 'en/index')).toBeDefined()
    expect(pages.find((p) => p.id === 'ja/index')).toBeDefined()
  })
})
