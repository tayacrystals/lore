import type { JSX } from 'preact'
import { urlWithBase } from '../config.ts'
import { ROOT_ID } from '../graph.ts'
import type { BuildContext, Page } from '../types.ts'
import { CaretIcon } from './icons.tsx'

interface SidebarProps {
  ctx: BuildContext
  activeId: string
}

/** The full sidebar nav tree, rendered from the content graph. */
export function Sidebar({ ctx, activeId }: SidebarProps): JSX.Element {
  const roots = ctx.graph.rootIds.map((id) => ctx.graph.pages.get(id)).filter((p): p is Page => !!p)
  const rootPage = ctx.graph.pages.get(ROOT_ID)
  return (
    <nav class="lore-sidebar-inner" aria-label="Documentation">
      {rootPage && !rootPage.synthetic ? (
        <NavNode page={rootPage} ctx={ctx} activeId={activeId} />
      ) : null}
      {roots.map((page) => (
        <NavNode page={page} ctx={ctx} activeId={activeId} />
      ))}
    </nav>
  )
}

function NavNode({
  page,
  ctx,
  activeId,
}: {
  page: Page
  ctx: BuildContext
  activeId: string
}): JSX.Element | null {
  if (page.hidden) return null

  if (page.isSection) {
    const children = page.childIds
      .map((id) => ctx.graph.pages.get(id))
      .filter((p): p is Page => !!p && !p.hidden)
    const containsActive = activeId === page.id || activeId.startsWith(`${page.id}/`)
    const label = page.synthetic ? (
      <span>{page.title}</span>
    ) : (
      <a href={urlWithBase(ctx.config.basePath, page.url)} data-section={page.id}>
        {page.title}
      </a>
    )
    return (
      <details class="lore-nav-group" open={containsActive || undefined}>
        <summary class="lore-nav-section">
          <span class="lore-caret">
            <CaretIcon />
          </span>
          {label}
        </summary>
        <div class="lore-nav-children">
          {children.map((child) => (
            <NavNode page={child} ctx={ctx} activeId={activeId} />
          ))}
        </div>
      </details>
    )
  }

  return (
    <a
      class="lore-nav-leaf"
      href={urlWithBase(ctx.config.basePath, page.url)}
      aria-current={activeId === page.id ? 'page' : undefined}
    >
      {page.title}
    </a>
  )
}
