import { beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadConfig, resolveBasePath, titleCase } from '@loredocs/lore'
describe('titleCase', () => {
  test('converts kebab-case', () => {
    expect(titleCase('my-project')).toBe('My Project')
  })

  test('converts snake_case', () => {
    expect(titleCase('getting_started')).toBe('Getting Started')
  })

  test('handles single word', () => {
    expect(titleCase('docs')).toBe('Docs')
  })

  test('handles multiple spaces', () => {
    expect(titleCase('foo   bar')).toBe('Foo Bar')
  })

  test('handles mixed separators', () => {
    expect(titleCase('lore-docs_site')).toBe('Lore Docs Site')
  })
})

describe('loadConfig', () => {
  let fixtureDir: string

  beforeAll(() => {
    fixtureDir = resolve(import.meta.dir, 'fixtures', 'basic')
  })

  test('loads lore.yml from fixture dir', async () => {
    const config = await loadConfig(fixtureDir)
    expect(config.title).toBe('Test Docs')
    expect(config.color).toBe('blue')
  })

  test('sets default outDir to dist', async () => {
    const config = await loadConfig(fixtureDir)
    expect(config.outDir).toBe('dist')
  })

  test('defaults theme to auto', async () => {
    const config = await loadConfig(fixtureDir)
    expect(config.theme).toBe('auto')
  })

  test('defaults minify to true', async () => {
    const config = await loadConfig(fixtureDir)
    expect(config.minify).toBe(true)
  })

  test('respects minify: false', async () => {
    const rootWithMinify = `${import.meta.dir}/fixtures/minify-off`
    await mkdir(rootWithMinify, { recursive: true })
    await Bun.write(`${rootWithMinify}/lore.yml`, 'minify: false\n')
    await Bun.write(`${rootWithMinify}/index.mdx`, '# Test\n')
    try {
      const config = await loadConfig(rootWithMinify)
      expect(config.minify).toBe(false)
    } finally {
      await rm(rootWithMinify, { recursive: true, force: true })
    }
  })

  test('infers title from directory name when no config exists', async () => {
    const _tmp = await Bun.write(`${import.meta.dir}/no-config-test/index.mdx`, '# No Config')
    try {
      const config = await loadConfig(resolve(import.meta.dir, 'no-config-test'))
      // The dir is "no-config-test" → "No Config Test"
      expect(config.title).toBe('No Config Test')
    } finally {
      await rm(`${import.meta.dir}/no-config-test`, { recursive: true, force: true })
    }
  })
})

describe('resolveBasePath', () => {
  test('extracts path from full URL', () => {
    expect(resolveBasePath('https://example.com/docs')).toBe('/docs')
  })

  test('extracts path with trailing slash', () => {
    expect(resolveBasePath('https://example.com/docs/')).toBe('/docs')
  })

  test('root URL returns empty string', () => {
    expect(resolveBasePath('https://example.com')).toBe('')
  })

  test('undefined returns empty string', () => {
    expect(resolveBasePath(undefined)).toBe('')
  })

  test('bare path returns the path', () => {
    expect(resolveBasePath('/lore')).toBe('/lore')
  })

  test('deep path with multiple segments', () => {
    expect(resolveBasePath('https://example.com/my/site/docs')).toBe('/my/site/docs')
  })
})
