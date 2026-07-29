import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { filesystem } from '@loredocs/plugin-filesystem'
import { buildGraph } from '@loredocs/lore'
import type { BuildContext } from '@loredocs/lore'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lore-fs-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFile(path: string, content: string): void {
  const dirs = path.split('/').slice(0, -1)
  let current = root
  for (const d of dirs) {
    current = join(current, d)
    mkdirSync(current, { recursive: true })
  }
  writeFileSync(join(root, path), content)
}

function ctx(): BuildContext {
  return {
    command: 'build',
    root,
    outDir: join(root, 'dist'),
    config: { title: 'Test', basePath: '' },
    graph: { pages: new Map(), rootIds: [] },
    plugins: [],
    components: {},
    assets: [],
  }
}

async function load(): Promise<ReturnType<typeof buildGraph>> {
  const pages = (await filesystem().load?.(ctx())) ?? []
  return buildGraph(pages)
}

describe('filesystem slug frontmatter', () => {
  test('overrides filename-derived slug for file pages', async () => {
    writeFile('guides/quick-start.mdx', '---\nslug: demarrage-rapide\n---\n# Quick Start')
    const graph = await load()

    const page = graph.pages.get('guides/demarrage-rapide')!
    expect(page).toBeDefined()
    expect(page.url).toBe('/guides/demarrage-rapide')
    expect(page.title).toBe('Quick Start')

    // Original slug should NOT exist
    expect(graph.pages.get('guides/quick-start')).toBeUndefined()
  })

  test('overrides directory slug for section index pages', async () => {
    writeFile('guides/index.mdx', '---\nslug: documentation\n---\n# Guides')
    const graph = await load()

    const page = graph.pages.get('documentation')!
    expect(page).toBeDefined()
    expect(page.url).toBe('/documentation')
    expect(page.isSection).toBe(true)
  })

  test('preserves parent path in nested slug override', async () => {
    writeFile('guides/01-intro.mdx', '---\nslug: introduction\n---\n# Intro')
    const graph = await load()

    const page = graph.pages.get('guides/introduction')!
    expect(page).toBeDefined()
    expect(page.url).toBe('/guides/introduction')
  })

  test('does not affect root index page', async () => {
    writeFile('index.mdx', '---\nslug: should-be-ignored\n---\n# Home')
    const graph = await load()

    const page = graph.pages.get('index')!
    expect(page).toBeDefined()
    expect(page.url).toBe('/')
  })
})
