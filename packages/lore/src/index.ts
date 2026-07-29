
import { build } from './build.ts'
import { dev } from './dev.ts'
import { serve } from './serve.ts'

// Public API: programmatic entry points.
export { build } from './build.ts'
export { dev } from './dev.ts'
export { serve } from './serve.ts'
export { createContext, runLoad, runValidate, collectContextAssets, pickRenderer } from './pipeline.ts'
export { renderPageHtml } from './render.tsx'
export { renderDocument } from './layout/Layout.tsx'
export { Sidebar } from './layout/Sidebar.tsx'
// Public API: types.
export type {
  Asset,
  BuildContext,
  ContentGraph,
  Frontmatter,
  LoreConfig,
  LorePlugin,
  Page,
  PluginFactory,
  PluginSpec,
} from './types.ts'

// Public API: content graph.
export { buildGraph, findPageByUrl, breadcrumbs, siblingsOf, prevNext, ROOT_ID } from './graph.ts'

// Public API: utilities.
export {
  slugify,
  parseFrontmatter,
  parseOrder,
  pathToSlug,
  resolveTitle,
  isHiddenName,
  isMarkdownFile,
  INDEX_BASENAMES,
} from './util.ts'

// Public API: config.
export { loadConfig, resolveOutDir, urlWithBase, resolveBasePath, titleCase } from './config.ts'

// Public API: assets.
export { collectAssets, linkableAssets, indexByUrl, readAsset } from './asset.ts'

// Public API: plugin resolution.
export { defaultPlugins, resolvePlugins } from './plugin-loader.ts'

export { aiAgent } from '@loredocs/plugin-ai-agent'
export type { AiAgentOptions } from '@loredocs/plugin-ai-agent'
// Re-export built-in plugins.
export { collections } from '@loredocs/plugin-collections'
export type { CollectionDef } from '@loredocs/plugin-collections'
export { components } from '@loredocs/plugin-components'
export type { ComponentsOptions } from '@loredocs/plugin-components'
export { deadLinks } from '@loredocs/plugin-dead-links'
export { expressiveCode } from '@loredocs/plugin-expressive-code'
export type { ExpressiveCodeOptions } from '@loredocs/plugin-expressive-code'
export { filesystem } from '@loredocs/plugin-filesystem'
export type { FilesystemOptions } from '@loredocs/plugin-filesystem'
export { i18n } from '@loredocs/plugin-i18n'
export type { I18nOptions, LocaleConfig } from '@loredocs/plugin-i18n'
export { mdx } from '@loredocs/plugin-mdx'
export type { MdxOptions } from '@loredocs/plugin-mdx'
export { search } from '@loredocs/plugin-search'
export type { SearchOptions } from '@loredocs/plugin-search'
export { versioning } from '@loredocs/plugin-versioning'
export type { VersioningOptions, VersionConfig } from '@loredocs/plugin-versioning'

// CLI entry: when run directly, dispatch build/dev
if (import.meta.main) {
  const command = process.argv[2]
  const dir = process.argv[3] ?? '.'
  const portFlag = process.argv.indexOf('--port')
  const port = portFlag !== -1 ? Number(process.argv[portFlag + 1]) : undefined

  if (command === 'build') {
    await build(dir)
    process.exit(0)
  } else if (command === 'dev') {
    await dev(dir, port)
  } else if (command === 'serve') {
    await serve(dir, port)
  } else {
    console.error('Usage: lore <build|dev|serve> <dir> [--port N]')
    process.exit(1)
  }
}
