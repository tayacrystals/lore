import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { copyFile, exists, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from '@loredocs/lore'

const FIXTURE_DIR = resolve(import.meta.dir, 'fixtures', 'basic')
const OUT_DIR = resolve(process.cwd(), `lore-test-dist-${process.pid}`)

describe('lore build', () => {
  beforeAll(async () => {
    // Save original lore.yml and write a temp one with our output dir
    const original = `${FIXTURE_DIR}/lore.yml`
    const bak = `${FIXTURE_DIR}/lore.yml.bak`
    await copyFile(original, bak)
    const yml = `title: Test Docs\ncolor: blue\noutDir: ${OUT_DIR}\n`
    await Bun.write(original, yml)
    await rm(OUT_DIR, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(OUT_DIR, { recursive: true, force: true })
    // Restore original lore.yml
    const bak = `${FIXTURE_DIR}/lore.yml.bak`
    await rename(bak, `${FIXTURE_DIR}/lore.yml`)
  })

  test('builds fixture directory without errors', async () => {
    await build(FIXTURE_DIR)
  })

  test('outputs index.html at root', async () => {
    const index = Bun.file(resolve(OUT_DIR, 'index.html'))
    expect(await index.exists()).toBe(true)
    const text = await index.text()
    expect(text).toContain('<!doctype html>')
    expect(text).toContain('Test Docs')
    expect(text).toContain('Welcome to the test documentation site')
  })

  test('outputs nested pages as pretty URLs', async () => {
    const qsDir = resolve(OUT_DIR, 'getting-started')
    const qsFile = resolve(qsDir, 'index.html')
    expect(await exists(qsDir)).toBe(true)
    expect(await exists(qsFile)).toBe(true)

    const text = await Bun.file(qsFile).text()
    expect(text).toContain('Getting Started')
    expect(text).toContain('Prerequisites')
  })

  test('outputs section directory pages', async () => {
    const guideFile = resolve(OUT_DIR, 'guides', 'index.html')
    expect(await exists(guideFile)).toBe(true)
    const text = await Bun.file(guideFile).text()
    expect(text).toContain('Guides')
  })

  test('outputs nested page under section', async () => {
    const qsFile = resolve(OUT_DIR, 'guides', 'quick-start', 'index.html')
    expect(await exists(qsFile)).toBe(true)
    const text = await Bun.file(qsFile).text()
    expect(text).toContain('Quick Start Guide')
  })

  test('includes search index JSON', async () => {
    const searchIndex = Bun.file(resolve(OUT_DIR, '__lore__', 'search-index.json'))
    expect(await searchIndex.exists()).toBe(true)
    const text = await searchIndex.text()
    const index = JSON.parse(text)
    expect(index).toBeInstanceOf(Array)
    expect(index.length).toBeGreaterThanOrEqual(1)
    // All rendered pages should be in the index
    const titles = index.map((e: { title: string }) => e.title)
    expect(titles).toContain('Getting Started')
    expect(titles).toContain('Quick Start Guide')
  })

  test('includes theme CSS', async () => {
    const cssFile = Bun.file(resolve(OUT_DIR, '__lore__', 'theme.css'))
    const text = await cssFile.text()
    expect(text).toContain(':root')
  })

  test('includes client JS', async () => {
    const jsFile = Bun.file(resolve(OUT_DIR, '__lore__', 'client.js'))
    expect(await jsFile.exists()).toBe(true)
  })

  test('ignores hidden files (underscore-prefixed)', async () => {
    // _hidden.md should not appear as a page — there should be no /hidden page
    const hiddenText = await Bun.file(resolve(OUT_DIR, 'getting-started', 'index.html')).text()
    expect(hiddenText).not.toContain('Hidden Page')
  })

  test('inlines assets into HTML', async () => {
    // accent style is inlined via inline: true
    const indexText = await Bun.file(resolve(OUT_DIR, 'index.html')).text()
    expect(indexText).toContain('--lore-accent')
    expect(indexText).toContain('#3b82f6') // blue accent
  })

  test('renders a sidebar with page links', async () => {
    const indexText = await Bun.file(resolve(OUT_DIR, 'index.html')).text()
    expect(indexText).toContain('Getting Started')
    expect(indexText).toContain('Guides')
  })

  test('minifies HTML output', async () => {
    const indexText = await Bun.file(resolve(OUT_DIR, 'index.html')).text()
    // Minified HTML should not have newlines between tags
    expect(indexText).not.toMatch(/>\s+\n\s+</)
  })
})
