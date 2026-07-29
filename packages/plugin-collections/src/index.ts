import { join } from 'node:path'
import { ROOT_ID, slugify } from '@loredocs/lore'
import type { BuildContext, LorePlugin, Page } from '@loredocs/lore'

export interface CollectionDef {
  name: string
  source: string
  template: string
  title?: string
  slug?: string
  sort?: string
  perPage?: number
  hidden?: boolean
  overviewTitle?: string
}

interface CollectionEntry {
  [key: string]: unknown
}

/** A version/locale scope for scoped collection generation. */
interface Scope {
  idPrefix: string
  urlPrefix: string
  subDir: string
  rootParentId: string
}

export function collections(): LorePlugin {
  return {
    name: 'lore:collections',
    async load(ctx) {
      const defs = parseCollectionDefs(ctx.config.collections)
      if (defs.length === 0) return []

      const scopes = computeScopes(ctx)
      const pages: Page[] = []

      for (const def of defs) {
        if (scopes.length === 0) {
          pages.push(...(await buildCollection(def, ctx)))
        } else {
          for (const scope of scopes) {
            pages.push(...(await buildCollection(def, ctx, scope)))
          }
        }
      }
      return pages
    },
  }
}

// --- scope detection ---------------------------------------------------------

/**
 * When versioning or i18n is active, collections must be generated per
 * version/locale combination with prefixed IDs/URLs.
 *
 * Returns [] when neither is active (global collections).
 */
function computeScopes(ctx: BuildContext): Scope[] {
  const i18nOpts = resolveI18n(ctx)
  const versioningOpts = resolveVersioning(ctx)
  if (!i18nOpts && !versioningOpts) return []

  const locales = i18nOpts?.locales ?? [{ code: '', dir: '' }]
  const versions = versioningOpts?.versions ?? []

  const scopes: Scope[] = []

  for (const locale of locales) {
    const localeDir = locale.dir ?? locale.code

    if (versions.length > 0) {
      for (const version of versions) {
        const subDir = [localeDir, version.dir].filter(Boolean).join('/')
        const idPrefix = [locale.code, version.dir].filter(Boolean).join('/')
        const parts = [locale.code, version.dir].filter(Boolean)
        const urlPrefix = `/${parts.join('/')}`
        scopes.push({ idPrefix, urlPrefix, subDir, rootParentId: `${idPrefix}/index` })
      }
    } else {
      scopes.push({
        idPrefix: locale.code,
        urlPrefix: `/${locale.code}`,
        subDir: localeDir,
        rootParentId: `${locale.code}/index`,
      })
    }
  }

  return scopes
}

function resolveI18n(ctx: BuildContext): { locales: { code: string; dir?: string }[] } | null {
  const raw = ctx.config.i18n
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).locales)) {
    return null
  }
  return raw as { locales: { code: string; dir?: string }[] }
}

function resolveVersioning(ctx: BuildContext): { versions: { dir: string }[] } | null {
  const raw = ctx.config.versioning
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).versions)) {
    return null
  }
  return raw as { versions: { dir: string }[] }
}

// --- collection building -----------------------------------------------------

function parseCollectionDefs(raw: unknown): CollectionDef[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isCollectionDef)
}

function isCollectionDef(v: unknown): v is CollectionDef {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.name === 'string' && typeof o.source === 'string' && typeof o.template === 'string'
}

async function buildCollection(
  def: CollectionDef,
  ctx: BuildContext,
  scope?: Scope,
): Promise<Page[]> {
  const basePath = scope ? join(ctx.root, scope.subDir) : ctx.root
  const entries = await loadJson(join(basePath, def.source))
  const templateText = await loadTemplate(join(basePath, def.template))
  if (!templateText) return []

  if (def.sort) {
    const sortField = def.sort
    entries.sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return String(av).localeCompare(String(bv))
    })
  }

  const rawCollectionId = slugify(def.name)
  const collectionId = scope ? `${scope.idPrefix}/${rawCollectionId}` : rawCollectionId
  const collectionUrl = scope ? `${scope.urlPrefix}/${rawCollectionId}` : `/${rawCollectionId}`
  const parentId = scope ? scope.rootParentId : ROOT_ID
  const overviewTitle = def.overviewTitle ?? def.name
  const perPage = def.perPage ?? 0
  const hideEntries = Boolean(def.hidden)
  const titleTmpl = def.title ?? '{{title}}'

  const entryPages: Page[] = []
  for (const [i, entry] of entries.entries()) {
    const entryTitle = interpolate(titleTmpl, entry)
    const entrySlug = interpolate(def.slug ?? '{{slug}}', entry, slugify(entryTitle))
    const body = interpolate(templateText, entry)

    entryPages.push({
      id: `${collectionId}/${entrySlug}`,
      url: `${collectionUrl}/${entrySlug}`,
      title: entryTitle,
      description: String(entry.description ?? ''),
      frontmatter: { _collection: def.name },
      body,
      isSection: false,
      order: i,
      parentId: collectionId,
      childIds: [],
      hidden: hideEntries,
      synthetic: true,
    })
  }

  return [
    ...buildOverviewPages({
      collectionId,
      collectionUrl,
      parentId,
      title: overviewTitle,
      entries: entryPages,
      perPage,
      entryData: entries,
      titleTemplate: titleTmpl,
    }),
    ...entryPages,
  ]
}

function buildOverviewPages(opts: {
  collectionId: string
  collectionUrl: string
  parentId: string
  title: string
  entries: Page[]
  perPage: number
  entryData: CollectionEntry[]
  titleTemplate: string
}): Page[] {
  const { collectionId, collectionUrl, parentId, title, entries, perPage, entryData, titleTemplate } = opts

  if (perPage <= 0 || entries.length <= perPage) {
    return [{
      id: collectionId,
      url: collectionUrl,
      title,
      description: `${entries.length} entries`,
      frontmatter: {},
      body: generateOverviewBody(entries, entryData, titleTemplate),
      isSection: true,
      order: Number.MAX_SAFE_INTEGER,
      parentId,
      childIds: entries.map((e) => e.id),
      synthetic: true,
    }]
  }

  const totalPages = Math.ceil(entries.length / perPage)
  const pages: Page[] = []

  for (let p = 0; p < totalPages; p++) {
    const start = p * perPage
    const slice = entries.slice(start, start + perPage)
    const dataSlice = entryData.slice(start, start + perPage)
    const isFirst = p === 0
    const id = isFirst ? collectionId : `${collectionId}/page/${p + 1}`
    const url = isFirst ? collectionUrl : `${collectionUrl}/page/${p + 1}`

    let body = generateOverviewBody(slice, dataSlice, titleTemplate)

    if (totalPages > 1) {
      body += '\n\n'
      const links: string[] = []
      for (let i = 0; i < totalPages; i++) {
        const pageUrl = i === 0 ? collectionUrl : `${collectionUrl}/page/${i + 1}`
        links.push(i === p ? `**${i + 1}**` : `[${i + 1}](${pageUrl})`)
      }
      body += `Pages: ${links.join(' | ')}\n`
    }

    pages.push({
      id,
      url,
      title: isFirst ? title : `${title} (Page ${p + 1})`,
      description: `${entries.length} entries`,
      frontmatter: {},
      body,
      isSection: isFirst,
      order: Number.MAX_SAFE_INTEGER,
      parentId: isFirst ? parentId : collectionId,
      childIds: isFirst ? entries.map((e) => e.id) : [],
      hidden: !isFirst,
      synthetic: true,
    })
  }

  return pages
}

function generateOverviewBody(
  entries: Page[],
  entryData: CollectionEntry[],
  titleTemplate: string,
): string {
  if (entries.length === 0) return ''

  const rows = entries
    .map((entry, i) => {
      const data = entryData[i]!
      const title = interpolate(titleTemplate, data, entry.title)
      return `| [${title}](${entry.url}) | ${data.date ?? ''} |`
    })
    .join('\n')

  return `| Title | Date |\n|-------|------|\n${rows}\n`
}

const INTERPOLATION_RE = /\{\{(\w+)\}\}/g

function interpolate(
  template: string,
  entry: CollectionEntry,
  fallbackForSlug?: string,
): string {
  return template.replace(INTERPOLATION_RE, (_match, field: string) => {
    const value = entry[field]
    if (value !== undefined) return String(value)
    if (field === 'slug' && fallbackForSlug !== undefined) return fallbackForSlug
    return `{{${field}}}`
  })
}

async function loadJson(absPath: string): Promise<CollectionEntry[]> {
  const file = Bun.file(absPath)
  if (!(await file.exists())) {
    console.warn(`[lore:collections] JSON source not found: ${absPath}`)
    return []
  }
  const text = await file.text()
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : [parsed]
}

async function loadTemplate(absPath: string): Promise<string | null> {
  const file = Bun.file(absPath)
  if (!(await file.exists())) {
    console.warn(`[lore:collections] template not found: ${absPath}`)
    return null
  }
  return file.text()
}
