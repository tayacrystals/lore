import { compile, run } from '@mdx-js/mdx'
import { h } from 'preact'
import { Fragment, jsx, jsxs } from 'preact/jsx-runtime'
import { render } from 'preact-render-to-string'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'

export interface MdxOptions {
  /** Override the default remark plugins. */
  remarkPlugins?: unknown[]
  /** Override the default rehype plugins. */
  rehypePlugins?: unknown[]
}

/**
 * Default MDX renderer. Compiles each page's body to a Preact component and
 * renders it to HTML with `preact-render-to-string`. The last plugin to
 * register `renderBody` wins, so user plugins can replace Markdown rendering.
 */
export function mdx(options?: MdxOptions): LorePlugin {
  return {
    name: 'lore:mdx',
    remarkPlugins: options?.remarkPlugins ?? [remarkGfm],
    rehypePlugins: options?.rehypePlugins ?? [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
    components: {},
    async renderBody(page, ctx) {
      if (!page.body.trim()) return ''
      const code = await compile(page.body, {
        outputFormat: 'function-body',
        jsxImportSource: 'preact',
        remarkPlugins: collectRemark(ctx) as never,
        rehypePlugins: collectRehype(ctx) as never,
      })
      const { default: Content } = await run(String(code), { Fragment, jsx, jsxs })
      const components = mergeComponents(ctx)
      return render(h(Content, { components: components as never }) as never)
    },
  }
}

function collectRemark(ctx: BuildContext): unknown[] {
  return ctx.plugins.flatMap((p) => p.remarkPlugins ?? [])
}

function collectRehype(ctx: BuildContext): unknown[] {
  return ctx.plugins.flatMap((p) => p.rehypePlugins ?? [])
}

function mergeComponents(ctx: BuildContext): Record<string, unknown> {
  return Object.assign({}, ...ctx.plugins.map((p) => p.components ?? {}))
}

// Re-exported for plugin authors implementing their own renderBody.
export type { BuildContext, Page }

// Markdown rendering pipeline — used by @loredocs/plugin-ai-agent to emit .md
// copies of pages. Swap these into `run(String(code), runtime)` in place of
// Preact's jsx/jsxs/Fragment to get Markdown output instead of HTML VNodes.
export { mdJsx, mdJsxs, mdFragment } from './markdown-jsx-runtime.ts'
export { markdownComponentMap } from './markdown-components.ts'
