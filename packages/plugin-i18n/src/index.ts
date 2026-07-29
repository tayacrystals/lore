import { render } from 'preact-render-to-string'
import { h } from 'preact'
import { Sidebar } from '@loredocs/lore'
import type { Asset, BuildContext, ContentGraph, LorePlugin, Page } from '@loredocs/lore'
import { filesystem } from '@loredocs/plugin-filesystem'

// --- Types -------------------------------------------------------------------

export interface LocaleConfig {
  /** ISO code used in URLs and page IDs (e.g. 'en', 'fr'). */
  code: string
  /** Human-readable label for the switcher UI (e.g. 'English'). */
  label: string
  /** Directory name on disk (defaults to code). */
  dir?: string
}

export interface VersionConfig {
  dir: string
  label: string
  urlPrefix?: string
}

export interface I18nOptions {
  locales: LocaleConfig[]
  defaultLocale?: string
}

// --- Plugin factory ----------------------------------------------------------

/**
 * i18n plugin. Always produces locale-prefixed pages (/<lang>/...).
 * Root / redirects to the default locale (and default version if versioning is active).
 *
 * When `config.versioning` is also present, i18n subsumes versioning and produces
 * the full locale × version cross-product: /<lang>/<version>/<page>.
 *
 * Reads options from `ctx.config.i18n` when called without arguments.
 */
export function i18n(options?: I18nOptions): LorePlugin {
  return {
    name: 'lore:i18n',

    async load(ctx) {
      const opts = resolveOptions(options, ctx)
      if (!opts) return []

      const versioningOpts = resolveVersioning(ctx)
      const pages: Page[] = []

      for (const locale of opts.locales) {
        const dir = locale.dir ?? locale.code

        if (versioningOpts) {
          // i18n + versioning: cross-product, locale-first nesting
          for (const version of versioningOpts.versions) {
            const subDir = `${dir}/${version.dir}`
            const prefix = `${locale.code}/${version.dir}`
            const urlPrefix = `/${locale.code}/${version.urlPrefix ?? version.dir}`
            const fs = filesystem({ subDir, idPrefix: prefix, urlPrefix })
            pages.push(...((await fs.load?.(ctx)) ?? []))
          }
        } else {
          // i18n only
          const fs = filesystem({ subDir: dir, idPrefix: locale.code, urlPrefix: `/${locale.code}` })
          pages.push(...((await fs.load?.(ctx)) ?? []))
        }
      }

      // Root redirects to default locale (+ default/latest version)
      const defaultLocale = opts.defaultLocale ?? opts.locales[0]?.code
      if (defaultLocale) {
        let targetPath = `/${defaultLocale}`
        if (versioningOpts) {
          const target = versioningOpts.defaultVersion ?? versioningOpts.versions[versioningOpts.versions.length - 1]?.dir
          if (target) targetPath += `/${versioningOpts.versions.find((v) => v.dir === target)?.urlPrefix ?? target}`
        }
        pages.push({
          id: 'index',
          url: '/',
          title: ctx.config.title,
          description: '',
          frontmatter: {},
          body: `<meta http-equiv="refresh" content="0; url=${targetPath}/" />`,
          isSection: false,
          order: 0,
          parentId: null,
          childIds: [],
          synthetic: true,
        })
      }

      return pages
    },

    clientAssets(ctx) {
      const opts = resolveOptions(options, ctx)
      if (!opts) return []

      const versioningOpts = resolveVersioning(ctx)
      const assets: Asset[] = []

      // Locale manifest
      const manifest = {
        locales: opts.locales.map((l) => ({ code: l.code, label: l.label })),
        defaultLocale: opts.defaultLocale ?? opts.locales[0]?.code ?? null,
        versions: versioningOpts?.versions.map((v) => ({
          dir: v.dir,
          label: v.label,
          urlPrefix: v.urlPrefix ?? `/${v.dir}`,
        })) ?? [],
        defaultVersion: versioningOpts?.defaultVersion ?? null,
      }

      assets.push({
        id: 'i18n:manifest',
        kind: 'resource',
        url: '/__lore__/locale-manifest.json',
        content: JSON.stringify(manifest),
      })

      // Per-locale search indices
      const locales = opts.locales
      const pages = [...ctx.graph.pages.values()]
      for (const locale of locales) {
        const localePages = pages.filter((p) => {
          if (p.synthetic) return false
          return p.id.startsWith(`${locale.code}/`)
        })
        if (localePages.length === 0) continue
        assets.push({
          id: `i18n:search-${locale.code}`,
          kind: 'resource',
          url: `/__lore__/search-index/${locale.code}.json`,
          content: JSON.stringify(
            localePages.map((p) => ({
              title: p.title,
              description: p.description ?? '',
              text: stripMarkdown(p.body).slice(0, 4000),
              url: p.url,
            })),
          ),
        })
      }

      return assets
    },

    transformHtml(page, html, ctx) {
      const opts = resolveOptions(options, ctx)
      if (!opts) return html

      const versioningOpts = resolveVersioning(ctx)
      const detected = detectLocale(page.id, opts.locales)
      if (!detected) return html

      // Determine the locale root for sidebar scoping
      const versionDir = versioningOpts
        ? detectVersionDir(page.id, versioningOpts.versions)
        : undefined

      const localeRootId = versionDir
        ? `${detected.code}/${versionDir}/index`
        : `${detected.code}/index`

      const localeRoot = ctx.graph.pages.get(localeRootId)
      if (!localeRoot) return html

      // Scoped sidebar
      const scopedCtx: BuildContext = {
        ...ctx,
        graph: { ...ctx.graph, rootIds: localeRoot.childIds },
      }
      const sidebarHtml = render(h(Sidebar, { ctx: scopedCtx, activeId: page.id }) as never)

      let result = html.replace(
        /(<aside class="lore-sidebar"[^>]*>)([\s\S]*?)(<\/aside>)/,
        `$1${sidebarHtml}$3`,
      )

      // Replace the existing lang attribute (Layout emits lang="en")
      result = result.replace(
        /lang="en"/,
        `lang="${detected.code}" data-locale="${detected.code}"`,
      )

      // Inject locale switcher after brand link
      const switcherHtml = renderLocaleSwitcher(
        page, detected, opts.locales, versioningOpts, ctx.graph,
      )
      result = result.replace(
        /(<a class="lore-brand"[^>]*>[\s\S]*?<\/a>)/,
        `$1${switcherHtml}`,
      )

      // Set locale-specific search index URL on search input
      const searchIndexUrl = `${ctx.config.basePath}/__lore__/search-index/${detected.code}.json`
      result = result.replace(
        /data-lore-search(?:="")?/,
        `data-lore-search data-index-url="${searchIndexUrl}"`,
      )

      // Inject version switcher if versioning is active
      if (versioningOpts && versionDir) {
        const versionSwitcherHtml = renderVersionSwitcher(
          page, detected, versionDir, versioningOpts, ctx.graph,
        )
        result = result.replace(
          /(<div class="lore-locale-switcher">[\s\S]*?<\/div>)/,
          `$1${versionSwitcherHtml}`,
        )
      }

      return result
    },
  }
}

// --- Helpers -----------------------------------------------------------------

function resolveOptions(options: I18nOptions | undefined, ctx: BuildContext): I18nOptions | null {
  if (options) return options
  const raw = ctx.config.i18n
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).locales)) {
    return null
  }
  return raw as I18nOptions
}

function resolveVersioning(ctx: BuildContext): { versions: VersionConfig[]; defaultVersion?: string } | null {
  const raw = ctx.config.versioning
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).versions)) {
    return null
  }
  return raw as { versions: VersionConfig[]; defaultVersion?: string }
}

function detectLocale(pageId: string, locales: LocaleConfig[]): LocaleConfig | null {
  for (const l of locales) {
    if (pageId.startsWith(`${l.code}/`)) return l
  }
  return null
}

function detectVersionDir(pageId: string, versions: VersionConfig[]): string | undefined {
  // Page ID format: <locale>/<version>/...  — extract version segment
  const parts = pageId.split('/')
  if (parts.length < 2) return undefined
  const second = parts[1]
  return versions.find((v) => v.dir === second)?.dir
}

function stripPrefix(pageId: string, localeCode: string, versionDir?: string): string {
  let id = pageId
  if (versionDir && id.startsWith(`${localeCode}/${versionDir}/`)) {
    id = id.slice(`${localeCode}/${versionDir}/`.length)
  } else if (id.startsWith(`${localeCode}/`)) {
    id = id.slice(`${localeCode}/`.length)
  }
  return id
}

function renderLocaleSwitcher(
  page: Page,
  current: LocaleConfig,
  locales: LocaleConfig[],
  versioningOpts: { versions: VersionConfig[]; defaultVersion?: string } | null,
  graph: ContentGraph,
): string {
  const versionDir = versioningOpts ? detectVersionDir(page.id, versioningOpts.versions) : undefined
  const baseId = stripPrefix(page.id, current.code, versionDir)

  const options = locales.map((loc) => {
    const targetId = versionDir
      ? `${loc.code}/${versionDir}/${baseId}`
      : `${loc.code}/${baseId}`
    const targetPage = graph.pages.get(targetId)
    const selected = loc.code === current.code ? 'selected' : ''
    if (!targetPage) {
      return `<option value="" disabled>${loc.label}</option>`
    }
    return `<option value="${targetPage.url}" ${selected}>${loc.label}</option>`
  }).join('')

  return `<div class="lore-locale-switcher"><select data-lore-locale-switcher>${options}</select></div>`
}

function renderVersionSwitcher(
  page: Page,
  currentLocale: LocaleConfig,
  currentVersionDir: string,
  versioningOpts: { versions: VersionConfig[]; defaultVersion?: string },
  graph: ContentGraph,
): string {
  const baseId = stripPrefix(page.id, currentLocale.code, currentVersionDir)

  const options = versioningOpts.versions.map((v) => {
    const targetId = `${currentLocale.code}/${v.dir}/${baseId}`
    const targetPage = graph.pages.get(targetId)
    const selected = v.dir === currentVersionDir ? 'selected' : ''
    if (!targetPage) {
      return `<option value="" disabled>${v.label}</option>`
    }
    return `<option value="${targetPage.url}" ${selected}>${v.label}</option>`
  }).join('')

  return `<div class="lore-version-switcher"><select data-lore-version-switcher>${options}</select></div>`
}

function stripMarkdown(body: string): string {
  return body
    .replace(/^---[\s\S]*?---/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`~[\]()]/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
}

export default i18n
