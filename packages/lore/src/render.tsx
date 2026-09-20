import { Fragment, h } from 'preact'
import { render } from 'preact-render-to-string'
import { urlWithBase } from './config.ts'
import { renderDocument } from './layout/Layout.tsx'
import { pickRenderer } from './pipeline.ts'
import type { BuildContext, Page } from './types.ts'

/**
 * Render a single page to a full HTML document.
 *
 *   1. Resolve the body HTML (synthetic sections get a directory listing;
 *      otherwise the active `renderBody` plugin compiles the source).
 *   2. Wrap in the document layout (which links core + plugin assets).
 *   3. Run every `transformHtml` hook in order.
 */
export async function renderPageHtml(page: Page, ctx: BuildContext): Promise<string> {
  const bodyHtml = prefixBodyUrls(await resolveBody(page, ctx), ctx.config.basePath)
  let html = renderDocument({ ctx, page, bodyHtml })
  for (const plugin of ctx.plugins) {
    if (plugin.transformHtml) html = await plugin.transformHtml(page, html, ctx)
  }
  return html
}

/**
 * Prefix root-relative URLs in the rendered body with the site basePath.
 * The chrome (sidebar, pager, …) is prefixed in Layout; body HTML is not —
 * without this, every markdown link breaks under sub-path hosting.
 * Applied to body only, so already-prefixed chrome links are never touched.
 */
function prefixBodyUrls(html: string, basePath: string): string {
  if (!basePath) return html
  // Match href/src/poster attributes starting with exactly one slash
  // (skips protocol-relative `//host`, hash anchors, and relative paths).
  return html.replace(/(\s(?:href|src|poster)=")\/(?!\/)/g, `$1${basePath}/`)
}

async function resolveBody(page: Page, ctx: BuildContext): Promise<string> {
  if (page.synthetic && page.isSection && !page.body.trim()) {
    return directoryListing(page, ctx)
  }
  const renderer = pickRenderer(ctx)
  if (!renderer?.renderBody) return page.body || ''
  return renderer.renderBody(page, ctx)
}

/** Auto-generated directory listing for sections without an `index.mdx`. */
export function directoryListing(page: Page, ctx: BuildContext): string {
  const children = page.childIds
    .map((id) => ctx.graph.pages.get(id))
    .filter((p): p is Page => !!p && !p.hidden)

  if (children.length === 0) return '<p>This section is empty.</p>'

  const tree = (
    <div class="lore-listing">
      {children.map((child) => (
        <a href={urlWithBase(ctx.config.basePath, child.url)}>
          <div class="title">{child.title}</div>
          {child.description ? <div class="desc">{child.description}</div> : null}
        </a>
      ))}
    </div>
  )
  return render(h(Fragment, {}, tree) as never)
}
