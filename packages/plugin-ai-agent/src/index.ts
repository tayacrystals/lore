/**
 * `@loredocs/plugin-ai-agent` — emits `.md` copies of every page, generates
 * `llms.txt` / `llms-full.txt`, and advertises markdown versions via
 * `<link rel="alternate" type="text/markdown">`.
 *
 * The plugin uses `@loredocs/plugin-mdx`'s exported markdown JSX runtime to
 * compile each page's MDX body to a Markdown string (not HTML), so the
 * output is faithful to what components actually render — no HTML→Markdown
 * round-trip or regex stripping.
 */

import { compile, run } from '@mdx-js/mdx'
import type { Asset, BuildContext, LorePlugin, Page } from '@loredocs/lore'
import { mdFragment, mdJsx, mdJsxs, markdownComponentMap } from '@loredocs/plugin-mdx'
import { buildLlmsTxt } from './llms-txt.ts'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AiAgentOptions {
  /** Generate `llms-full.txt` with full page content. Default: `true`. */
  llmsFull?: boolean
  /** Maximum characters per page in `llms-full.txt`. Default: unlimited. */
  maxContentLength?: number
  /** Include hidden pages in `.md` / `llms.txt` output. Default: `false`. */
  hiddenPages?: boolean
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function aiAgent(options?: AiAgentOptions): LorePlugin {
  const llmsFull = options?.llmsFull !== false
  const maxLen = options?.maxContentLength ?? Number.MAX_SAFE_INTEGER
  const includeHidden = options?.hiddenPages === true

  return {
    name: 'lore:ai-agent',

    async clientAssets(ctx): Promise<Asset[]> {
      const assets: Asset[] = []
      const pages = [...ctx.graph.pages.values()]

      for (const page of pages) {
        if (page.hidden && !includeHidden) continue

        const mdContent = await renderPageToMarkdown(page, ctx)
        if (!mdContent) continue

        // Emit .md file at page URL + .md suffix
        const mdUrl = page.url === '/' ? '/index.md' : `${page.url}.md`
        assets.push({
          id: `ai-md:${page.id}`,
          kind: 'resource',
          url: mdUrl,
          content: mdContent,
        })
      }

      // llms.txt — index of all pages
      const llms = buildLlmsTxt(pages, ctx, includeHidden)
      assets.push({
        id: 'ai:llms-txt',
        kind: 'resource',
        url: '/llms.txt',
        content: llms,
      })

      // llms-full.txt — index + full content
      if (llmsFull) {
        const llmsFullContent = buildLlmsFullTxt(pages, ctx, includeHidden, maxLen, assets)
        assets.push({
          id: 'ai:llms-full-txt',
          kind: 'resource',
          url: '/llms-full.txt',
          content: llmsFullContent,
        })
      }

      return assets
    },

    transformHtml(page, html, _ctx) {
      if (page.hidden && !includeHidden) return html
      const mdUrl = page.url === '/' ? '/index.md' : `${page.url}.md`
      const link = `  <link rel="alternate" type="text/markdown" href="${mdUrl}" />`
      return html.replace('</head>', `${link}\n</head>`)
    },
  }
}

// ---------------------------------------------------------------------------
// Markdown page rendering
// ---------------------------------------------------------------------------

async function renderPageToMarkdown(page: Page, ctx: BuildContext): Promise<string | null> {
  const parts: string[] = []
  // Title
  parts.push(`# ${page.title}`)

  // Description
  if (page.description) {
    parts.push('', page.description)
  }

  // Body — strip the leading h1 from the rendered output since we emit
  // the title ourselves, avoiding a double `# Title`.
  const body = page.body.trim()
  if (body) {
    let md = await compileMdxToMarkdown(body, ctx)
    // Remove leading h1 if it matches the page title (the h1 used for
    // title inference gets rendered by the MDX compiler again).
    const h1Pattern = new RegExp(`^# ${escapeRegex(page.title)}\\s*\\n{1,2}`)
    md = md.replace(h1Pattern, '')
    parts.push('', md.trimStart())
  } else if (page.synthetic) {
    if (!page.description) {
      parts.push('', '*This section is empty.*')
    }
  }

  const result = parts.join('\n')
  return result || null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function compileMdxToMarkdown(source: string, ctx: BuildContext): Promise<string> {
  try {
    const code = await compile(source, {
      outputFormat: 'function-body',
      jsxImportSource: 'preact', // compile-time hint only; runtime is swapped below
      remarkPlugins: collectGfm(ctx) as never,
      // Explicitly no rehype plugins — they produce HTML, not markdown.
      rehypePlugins: [],
    })

    const { default: Content } = await run(String(code), {
      Fragment: mdFragment,
      jsx: mdJsx,
      jsxs: mdJsxs,
    })

    const components = { ...markdownComponentMap }
    return mdJsx(Content, { components }) as string
  } catch {
    // If MDX compilation fails (e.g. the body has only templating syntax
    // that MDX can't parse), fall back to the raw body text.
    return stripFrontmatter(source)
  }
}

/** Collect GFM and bare markdown plugins (skip HTML-producing rehype plugins). */
function collectGfm(ctx: BuildContext): unknown[] {
  const result: unknown[] = []
  for (const plugin of ctx.plugins) {
    if (plugin.remarkPlugins) {
      result.push(...plugin.remarkPlugins)
    }
  }
  return result
}

/** Strip YAML frontmatter from raw text. */
function stripFrontmatter(source: string): string {
  return source.replace(/^---[\s\S]*?---\n?/, '')
}

// ---------------------------------------------------------------------------
// llms-full.txt — index with full page content
// ---------------------------------------------------------------------------

function buildLlmsFullTxt(
  pages: Page[],
  ctx: BuildContext,
  includeHidden: boolean,
  maxLen: number,
  mdAssets: Asset[],
): string {
  const lines: string[] = []

  // Build a map of page ID → markdown content
  const mdMap = new Map<string, string>()
  for (const asset of mdAssets) {
    if (asset.id?.startsWith('ai-md:')) {
      const pageId = asset.id.slice('ai-md:'.length)
      if (asset.content) mdMap.set(pageId, asset.content)
    }
  }

  const visible = pages.filter((p) => !p.hidden || includeHidden)
  const title = ctx.config.title ?? 'Documentation'
  const desc = ctx.config.description ?? ''

  lines.push(`# ${title}`)
  if (desc) lines.push('', `> ${desc}`)
  lines.push('')

  for (const page of visible) {
    if (page.synthetic && !page.body.trim() && !page.description) continue

    let heading = page.title

    // Determine section context from parent
    const parent = page.parentId ? pages.find((p) => p.id === page.parentId) : null
    if (parent && parent.id !== 'index') {
      heading = `${parent.title} > ${heading}`
    }

    const mdContent = mdMap.get(page.id)
    const excerpt = mdContent
      ? mdContent.slice(0, maxLen)
      : page.description ?? ''

    lines.push(`## ${heading}`)
    lines.push('')
    if (excerpt) lines.push(excerpt)
    if (!excerpt.endsWith('\n')) lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
