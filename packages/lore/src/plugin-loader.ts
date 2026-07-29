import { isAbsolute, resolve } from 'node:path'
import type { LoreConfig, LorePlugin, PluginSpec } from "./types.ts"
import { collections } from '@loredocs/plugin-collections'
import { components } from '@loredocs/plugin-components'
import { deadLinks } from '@loredocs/plugin-dead-links'
import { expressiveCode } from '@loredocs/plugin-expressive-code'
import { filesystem } from '@loredocs/plugin-filesystem'
import { mdx } from '@loredocs/plugin-mdx'
import { search } from '@loredocs/plugin-search'
import { aiAgent } from '@loredocs/plugin-ai-agent'

/** Default plugins, always registered first (before user plugins). */
export function defaultPlugins(config?: LoreConfig): LorePlugin[] {
  const plugins: LorePlugin[] = []
  // Skip the filesystem plugin when versioning is active — the versioning
  // plugin composes its own filesystem instances per version directory.
  if (!config?.i18n && !config?.versioning) plugins.push(filesystem())
  plugins.push(collections(), mdx(), deadLinks(), search(), expressiveCode(), components(), aiAgent())
  return plugins
}

/**
 * Resolve the full plugin list: defaults first, then every spec from config.
 * A spec may be a package name, a local path, or an already-built plugin.
 */
export async function resolvePlugins(specs: PluginSpec[], root: string, config?: LoreConfig): Promise<LorePlugin[]> {
  const plugins: LorePlugin[] = [...defaultPlugins(config)]

  for (const spec of specs) {
    try {
      plugins.push(await resolveOne(spec, root))
    } catch (error) {
      const name = describeSpec(spec)
      console.warn(`[lore] could not load plugin "${name}": ${(error as Error).message}`)
    }
  }
  return plugins
}

const PLUGIN_HOOKS = [
  'load',
  'validate',
  'renderBody',
  'transformHtml',
  'clientAssets',
  'remarkPlugins',
  'rehypePlugins',
  'components',
] as const

/** An inline spec that already exposes plugin hooks is a plugin instance. */
function isPluginInstance(spec: PluginSpec): spec is LorePlugin {
  if (typeof spec === 'string') return false
  return PLUGIN_HOOKS.some((hook) => hook in spec)
}

async function resolveOne(spec: PluginSpec, root: string): Promise<LorePlugin> {
  if (isPluginInstance(spec)) return spec

  const name = typeof spec === 'string' ? spec : spec.name
  const options = typeof spec === 'string' ? undefined : spec.options
  const mod = await importModule(name, root)
  const factory = (mod.default ?? mod) as unknown

  if (typeof factory === 'function') return factory(options)
  if (factory && typeof factory === 'object' && 'name' in factory) return factory as LorePlugin

  throw new Error(`"${name}" does not export a plugin factory or plugin object`)
}

async function importModule(name: string, root: string): Promise<Record<string, unknown>> {
  const target = looksLikePath(name) ? resolve(root, name) : name
  const specifier = isAbsolute(target) ? `file://${target}` : target
  return import(specifier)
}

function looksLikePath(name: string): boolean {
  return (
    name.startsWith('.') || name.startsWith('/') || name.endsWith('.ts') || name.endsWith('.js')
  )
}

function describeSpec(spec: PluginSpec): string {
  if (typeof spec === 'string') return spec
  if ('name' in spec) return spec.name
  return '<inline>'
}
