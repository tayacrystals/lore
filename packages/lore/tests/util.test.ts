import { describe, expect, test } from 'bun:test'
import {
  isHiddenName,
  isMarkdownFile,
  parseFrontmatter,
  parseOrder,
  pathToSlug,
  resolveTitle,
} from '@loredocs/lore'

describe('parseFrontmatter', () => {
  test('parses leading YAML frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter(`---
title: Hello
description: A test
---
# Body

Content here.`)
    expect(frontmatter.title).toBe('Hello')
    expect(frontmatter.description).toBe('A test')
    expect(body).toBe('# Body\n\nContent here.')
  })

  test('returns empty frontmatter when none exists', () => {
    const { frontmatter, body } = parseFrontmatter('# Just a heading')
    expect(frontmatter).toEqual({})
    expect(body).toBe('# Just a heading')
  })

  test('treats empty frontmatter block as body', () => {
    // The regex requires content between the delimiters, so `---\n---\n# Body`
    // is not recognized as frontmatter — the whole input is treated as body.
    const { frontmatter, body } = parseFrontmatter('---\n---\n# Body')
    expect(frontmatter).toEqual({})
    expect(body).toBe('---\n---\n# Body')
  })

  test('handles Windows-style line endings', () => {
    const { frontmatter, body } = parseFrontmatter('---\r\ntitle: Win\r\n---\r\n# Body')
    expect(frontmatter.title).toBe('Win')
    expect(body).toBe('# Body')
  })
})

describe('parseOrder', () => {
  test('extracts numeric prefix', () => {
    expect(parseOrder('01-intro')).toEqual({ base: 'intro', order: 1 })
    expect(parseOrder('10-install')).toEqual({ base: 'install', order: 10 })
  })

  test('handles underscore separator', () => {
    expect(parseOrder('02_guides')).toEqual({ base: 'guides', order: 2 })
  })

  test('returns max order for unprefixed names', () => {
    const result = parseOrder('readme')
    expect(result.base).toBe('readme')
    expect(result.order).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('pathToSlug', () => {
  test('root index resolves to /', () => {
    expect(pathToSlug('index.mdx')).toEqual({ id: 'index', url: '/' })
  })

  test('strips numeric prefix', () => {
    expect(pathToSlug('01-intro.mdx')).toEqual({ id: 'intro', url: '/intro' })
  })

  test('nested page gets correct path', () => {
    expect(pathToSlug('guides/quick-start.mdx')).toEqual({
      id: 'guides/quick-start',
      url: '/guides/quick-start',
    })
  })

  test('directory index strips the index segment', () => {
    expect(pathToSlug('guides/index.mdx')).toEqual({ id: 'guides', url: '/guides' })
  })

  test('handles .md extension', () => {
    expect(pathToSlug('about.md')).toEqual({ id: 'about', url: '/about' })
  })

  test('readme treated as index', () => {
    expect(pathToSlug('readme.md')).toEqual({ id: 'index', url: '/' })
  })

  test('nested readme treated as section index', () => {
    expect(pathToSlug('section/README.mdx')).toEqual({ id: 'section', url: '/section' })
  })
})

describe('resolveTitle', () => {
  test('frontmatter title wins', () => {
    const title = resolveTitle({
      frontmatter: { title: 'My Page' },
      body: '# Different Title',
      fallback: 'Fallback',
    })
    expect(title).toBe('My Page')
  })

  test('leading h1 is fallback', () => {
    const title = resolveTitle({
      frontmatter: {},
      body: '# My Heading\n\nSome content.',
      fallback: 'Fallback',
    })
    expect(title).toBe('My Heading')
  })

  test('last segment title-case is secondary fallback', () => {
    const title = resolveTitle({
      frontmatter: {},
      body: 'No heading here.',
      lastSegment: 'quick-start',
      fallback: 'Default',
    })
    expect(title).toBe('Quick Start')
  })

  test('fallback used when nothing else works', () => {
    const title = resolveTitle({
      frontmatter: {},
      body: '',
      fallback: 'Untitled',
    })
    expect(title).toBe('Untitled')
  })

  test('empty frontmatter title is ignored', () => {
    const title = resolveTitle({
      frontmatter: { title: '' },
      body: '# Real Title',
      fallback: 'Fallback',
    })
    expect(title).toBe('Real Title')
  })
})

describe('isHiddenName', () => {
  test('underscore prefix is hidden', () => {
    expect(isHiddenName('_draft.md')).toBe(true)
  })

  test('dot prefix is hidden', () => {
    expect(isHiddenName('.hidden')).toBe(true)
  })

  test('normal file is not hidden', () => {
    expect(isHiddenName('index.mdx')).toBe(false)
  })
})

describe('isMarkdownFile', () => {
  test('recognizes .mdx files', () => {
    expect(isMarkdownFile('page.mdx')).toBe(true)
  })

  test('recognizes .md files', () => {
    expect(isMarkdownFile('page.md')).toBe(true)
  })

  test('rejects non-markdown files', () => {
    expect(isMarkdownFile('page.html')).toBe(false)
    expect(isMarkdownFile('style.css')).toBe(false)
  })
})
