import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { loadConfig, resolveOutDir } from '@loredocs/lore'
import { collectContextAssets, createContext, runLoad, runValidate } from '@loredocs/lore'
import { resolvePlugins } from '../src/plugin-loader.ts'
import { renderPageHtml } from '@loredocs/lore'

const FIXTURE_DIR = resolve(import.meta.dir, 'fixtures', 'basic')

describe('lore dev context', () => {
  test('creates context and loads content graph', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)
    await runValidate(ctx)
    await collectContextAssets(ctx)

    // Should have loaded all pages
    const pageIds = [...ctx.graph.pages.keys()]
    expect(pageIds).toContain('index')
    expect(pageIds).toContain('getting-started')
    expect(pageIds).toContain('guides')
    expect(pageIds).toContain('guides/quick-start')
  })

  test('load does not include hidden files', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)

    // _hidden.md should not be a page
    expect(ctx.graph.pages.has('hidden')).toBe(false)
  })

  test('sets correct metadata on pages', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)

    const index = ctx.graph.pages.get('index')
    expect(index?.title).toBe('Test Docs')
    expect(index?.url).toBe('/')
    expect(index?.isSection).toBe(false)

    const quickStart = ctx.graph.pages.get('guides/quick-start')
    expect(quickStart?.title).toBe('Quick Start Guide')
    expect(quickStart?.url).toBe('/guides/quick-start')
    expect(quickStart?.description).toBe('Get up and running in 5 minutes.')
  })

  test('sections are marked correctly', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)

    const guides = ctx.graph.pages.get('guides')
    expect(guides?.isSection).toBe(true)
    expect(guides?.childIds).toContain('guides/quick-start')
  })

  test('renders pages without error', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)
    await runValidate(ctx)
    await collectContextAssets(ctx)

    for (const page of ctx.graph.pages.values()) {
      const html = await renderPageHtml(page, ctx)
      expect(html).toContain('<!doctype html>')
    }
  })

  test('validate phase does not throw on valid content', async () => {
    const config = await loadConfig(FIXTURE_DIR)
    const outDir = resolveOutDir(config)
    const plugins = await resolvePlugins(config.plugins ?? [], FIXTURE_DIR, config)
    const ctx = await createContext({ command: 'dev', root: FIXTURE_DIR, outDir, config, plugins })
    await runLoad(ctx)
    // Should not throw
    await runValidate(ctx)
  })
})
