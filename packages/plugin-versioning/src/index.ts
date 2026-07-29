import { render } from 'preact-render-to-string'
import { h } from 'preact'
import { Sidebar } from '@loredocs/lore'
import type { Asset, BuildContext, LorePlugin, Page } from '@loredocs/lore'
import { filesystem } from '@loredocs/plugin-filesystem'

// --- Types -------------------------------------------------------------------

export interface VersionConfig {
  dir: string
  label: string
  urlPrefix?: string
}

export interface VersioningOptions {
  versions: VersionConfig[]
  defaultVersion?: string
}

// --- Plugin factory ----------------------------------------------------------

/**
 * Versioning plugin. When called without options, reads config from
 * `ctx.config.versioning` — so it can be listed in lore.yml as a bare
 * package name. When called programmatically, pass options directly.
 */
export function versioning(options?: VersioningOptions): LorePlugin {
  return {
    name: 'lore:versioning',

    async load(ctx) {
      const opts = resolveOptions(options, ctx)
      if (!opts) return []

      const pages: Page[] = []

      // Always produce prefixed pages — canonical URLs are always /vN/...
      for (const version of opts.versions) {
        const prefix = version.urlPrefix ?? `/${version.dir}`
        const fs = filesystem({ subDir: version.dir, idPrefix: version.dir, urlPrefix: prefix })
        pages.push(...((await fs.load?.(ctx)) ?? []))
      }

      // Root always redirects to the default (or latest) version
      const target = opts.defaultVersion ?? opts.versions[opts.versions.length - 1]?.dir
      if (target) {
        const targetPrefix = opts.versions.find((v) => v.dir === target)?.urlPrefix ?? `/${target}`
        pages.push({
          id: 'index',
          url: '/',
          title: ctx.config.title,
          description: '',
          frontmatter: {},
          body: `<meta http-equiv="refresh" content="0; url=${targetPrefix}/" />`,
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

      const manifest = {
        versions: opts.versions.map((v) => ({
          label: v.label,
          urlPrefix: v.urlPrefix ?? `/${v.dir}`,
          dir: v.dir,
        })),
        defaultVersion: opts.defaultVersion ?? null,
      }

      return [{
        id: 'versioning:manifest',
        kind: 'resource',
        url: '/__lore__/version-manifest.json',
        content: JSON.stringify(manifest),
      }] satisfies Asset[]
    },

    transformHtml(page, html, ctx) {
      const opts = resolveOptions(options, ctx)
      if (!opts) return html

      const currentVersion = detectVersion(page.id, opts.versions, opts.defaultVersion)
      if (!currentVersion) return html

      const versionRootId = page.id.startsWith(`${currentVersion.dir}/`)
        ? `${currentVersion.dir}/index`
        : 'index'

      const versionRoot = ctx.graph.pages.get(versionRootId)
      if (!versionRoot) return html

      const scopedCtx: BuildContext = {
        ...ctx,
        graph: { ...ctx.graph, rootIds: versionRoot.childIds },
      }

      const sidebarHtml = render(h(Sidebar, { ctx: scopedCtx, activeId: page.id }) as never)

      let result = html.replace(
        /(<aside class="lore-sidebar"[^>]*>)([\s\S]*?)(<\/aside>)/,
        `$1${sidebarHtml}$3`,
      )

      result = result.replace('<html', `<html data-version-dir="${currentVersion.dir}"`)

      const switcherHtml = renderVersionSwitcher(currentVersion, opts.versions)
      result = result.replace(
        /(<a class="lore-brand"[^>]*>[\s\S]*?<\/a>)/,
        `$1${switcherHtml}`,
      )

      return result
    },
  }
}

// --- Helpers -----------------------------------------------------------------

function resolveOptions(options: VersioningOptions | undefined, ctx: BuildContext): VersioningOptions | null {
  if (options) return options
  const raw = ctx.config.versioning
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).versions)) {
    return null
  }
  return raw as VersioningOptions
}

function detectVersion(pageId: string, versions: VersionConfig[], defaultVersion?: string): VersionConfig | null {
  for (const v of versions) {
    if (pageId.startsWith(`${v.dir}/`) || pageId === v.dir) return v
  }
  // Unprefixed pages belong to the default version
  if (defaultVersion) {
    return versions.find((v) => v.dir === defaultVersion) ?? null
  }
  return null
}

function renderVersionSwitcher(current: VersionConfig, versions: VersionConfig[]): string {
  const currentPrefix = current.urlPrefix ?? `/${current.dir}`
  const options = versions
    .map((v) => {
      const prefix = v.urlPrefix ?? `/${v.dir}`
      const selected = prefix === currentPrefix ? 'selected' : ''
      return `<option value="${prefix}" ${selected}>${v.label}</option>`
    })
    .join('')

  return `<div class="lore-version-switcher"><select data-lore-version-switcher>${options}</select></div>`
}

export default versioning
