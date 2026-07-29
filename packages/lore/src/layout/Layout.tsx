import type { JSX, VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { linkableAssets } from '../asset.ts'
import { urlWithBase } from '../config.ts'
import { breadcrumbs, prevNext } from '../graph.ts'
import type { Asset, BuildContext, Page } from '../types.ts'
import { ArrowIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from './icons.tsx'
import { Sidebar } from './Sidebar.tsx'

export interface LayoutProps {
  ctx: BuildContext
  page: Page
  bodyHtml: string
}

/** Render the full HTML document for a page. */
export function renderDocument(props: LayoutProps): string {
  const tree = <Document {...props} />
  return `<!doctype html>\n${render(tree as VNode)}`
}

function Document({ ctx, page, bodyHtml }: LayoutProps): JSX.Element {
  const config = ctx.config
  const crumbs = breadcrumbs(ctx.graph, page)
  const { prev, next } = prevNext(ctx.graph, page)
  const bp = config.basePath
  const canonical = config.baseUrl ? `${trimSlash(config.baseUrl)}${page.url}` : undefined
  const logoUrl = config.logo ? urlWithBase(bp, assetUrl(config.logo)) : undefined
  const { styles, scripts } = linkableAssets(ctx.assets)
  const themeInit =
    "(function(){try{var t=localStorage.getItem('lore-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();"

  // Speculation Rules API: prefetch internal links on hover/focus.
  // Chrome/Edge use this natively; Firefox/Safari ignore it gracefully.
  const speculationRules = JSON.stringify({
    prefetch: [{
      source: 'document',
      where: { selector_matches: 'a[href]' },
      eagerness: 'moderate',
    }],
  })

  const nextUrl = next ? urlWithBase(bp, next.url) : undefined

  return (
    <html lang="en" data-theme="light">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle(page, config.title)}</title>
        {page.description ? <meta name="description" content={page.description} /> : null}
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:title" content={page.title} />
        <meta property="og:type" content="website" />
        {page.description ? <meta property="og:description" content={page.description} /> : null}
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script type="speculationrules" dangerouslySetInnerHTML={{ __html: speculationRules }} />
        {nextUrl ? <link rel="prefetch" href={nextUrl} /> : null}
        {styles.map((asset) => renderStyle(asset, bp))}
      </head>
      <body>
        <div class="lore-app" id="lore-app">
          <aside class="lore-sidebar" aria-label="Sidebar">
            <Sidebar ctx={ctx} activeId={page.id} />
          </aside>
          <div class="lore-backdrop" data-close-sidebar="" />
          <div class="lore-main">
            <header class="lore-header">
              <button
                class="lore-icon-btn lore-menu-btn"
                type="button"
                aria-label="Toggle sidebar"
                data-toggle-sidebar=""
              >
                <MenuIcon />
              </button>
              <a class="lore-brand" href={urlWithBase(bp, '/')}>
                {logoUrl ? <img src={logoUrl} alt="" /> : null}
                <span>{config.title}</span>
              </a>
              <span class="lore-header-spacer" />
              <div class="lore-search" id="lore-search">
                <span class="lore-search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  placeholder="Search docs…"
                  aria-label="Search docs"
                  autocomplete="off"
                  data-lore-search=""
                  data-base-path={bp}
                />
                <div class="lore-search-results" data-lore-results="" />
              </div>
              <button
                class="lore-icon-btn"
                type="button"
                aria-label="Toggle theme"
                data-lore-theme=""
              >
                <span data-icon="sun">
                  <SunIcon />
                </span>
                <span data-icon="moon">
                  <MoonIcon />
                </span>
              </button>
            </header>
            <main class="lore-content" id="lore-content">
              {crumbs.length > 1 ? (
                <nav class="lore-breadcrumbs" aria-label="Breadcrumb">
                  {crumbs.map((c, i) => (
                    <span>
                      {i > 0 ? <span aria-hidden="true">/</span> : null}
                      {i < crumbs.length - 1 ? (
                        <a href={urlWithBase(bp, c.url)}>{c.title}</a>
                      ) : (
                        <span>{c.title}</span>
                      )}
                    </span>
                  ))}
                </nav>
              ) : null}
              <h1 class="lore-h1">{page.title}</h1>
              {page.description ? <p class="lore-lead">{page.description}</p> : null}
              <div class="lore-prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              {prev || next ? (
                <nav class="lore-pager" aria-label="Pager">
                  {prev ? (
                    <a href={urlWithBase(bp, prev.url)}>
                      <span class="label">Previous</span>
                      <span class="title">{prev.title}</span>
                    </a>
                  ) : null}
                  {next ? (
                    <a class="lore-next" href={urlWithBase(bp, next.url)}>
                      <span class="label">Next</span>
                      <span class="title">{next.title}</span>
                    </a>
                  ) : null}
                </nav>
              ) : null}
            </main>
          </div>
        </div>
        {scripts.map((asset) => renderScript(asset, bp))}

        {/* referenced to keep the arrow icon bundled for future pager tweaks */}
        <span style="display:none">
          <ArrowIcon dir="left" />
        </span>
      </body>
    </html>
  )
}
function renderStyle(asset: Asset, basePath: string): JSX.Element {
  const href = asset.inline ? undefined : urlWithBase(basePath, asset.url ?? '')
  if (asset.inline && asset.content !== undefined) {
    return <style dangerouslySetInnerHTML={{ __html: asset.content }} />
  }
  return <link rel="stylesheet" href={href} />
}

function renderScript(asset: Asset, basePath: string): JSX.Element {
  const src = asset.inline ? undefined : urlWithBase(basePath, asset.url ?? '')
  if (asset.inline && asset.content !== undefined) {
    return <script dangerouslySetInnerHTML={{ __html: asset.content }} />
  }
  return <script src={src} defer />
}

function pageTitle(page: Page, siteTitle: string): string {
  return page.url === '/' ? siteTitle : `${page.title} · ${siteTitle}`
}

function assetUrl(path: string): string {
  return path.replace(/^\.\//, '/')
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, '')
}
