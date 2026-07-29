import { resolve } from 'node:path'
import { parse } from 'yaml'
import type { LoreConfig, PluginSpec } from './types.ts'

const CONFIG_FILES = ['lore.yml', 'lore.yaml', 'lore.json'] as const

/** Locate and load `lore.yml` from `root`, with zero-config defaults applied. */
export async function loadConfig(root: string): Promise<LoreConfig> {
  const raw = await readRaw(root)
  const dirName = root.split('/').filter(Boolean).at(-1) ?? 'Lore'

  return {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title : titleCase(dirName),
    description: optionalString(raw.description),
    color: optionalString(raw.color),
    logo: optionalString(raw.logo),
    baseUrl: optionalString(raw.baseUrl),
    outDir: typeof raw.outDir === 'string' ? raw.outDir : 'dist',
    basePath: resolveBasePath(raw.baseUrl as string | undefined),
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'auto',
    frontmatterDefaults: asObject(raw.frontmatterDefaults),
    plugins: normalizePlugins(raw.plugins),
    minify: raw.minify !== false,
  }
}

/** Absolute output directory for a config (`outDir` resolved against the CWD). */
export function resolveOutDir(config: LoreConfig): string {
  return resolve(process.cwd(), config.outDir ?? 'dist')
}

/** Extract the path component from a baseUrl for sub-path hosting. */
export function resolveBasePath(baseUrl: string | undefined): string {
  if (!baseUrl) return ''
  try {
    const url = new URL(baseUrl)
    const path = url.pathname.replace(/\/+$/, '')
    return path === '/' ? '' : path
  } catch {
    // If it's just a path like `/docs`, treat it directly.
    if (baseUrl.startsWith('/')) return baseUrl.replace(/\/+$/, '')
    return ''
  }
}

/** Prepend basePath to a URL when serving under a sub-path. */
export function urlWithBase(basePath: string, url: string): string {
  if (!basePath || basePath === '/') return url
  return `${basePath}${url}`
}

async function readRaw(root: string): Promise<Record<string, unknown>> {
  for (const name of CONFIG_FILES) {
    const file = `${root}/${name}`
    if (await Bun.file(file).exists()) {
      const text = await Bun.file(file).text()
      return name.endsWith('.json') ? JSON.parse(text) : (parse(text) ?? {})
    }
  }
  return {}
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function normalizePlugins(value: unknown): PluginSpec[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    if (typeof entry === 'string') return entry
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const { name, options } = entry as { name: string; options?: Record<string, unknown> }
      return { name, options } as PluginSpec
    }
    return entry as PluginSpec
  })
}

/** Title-case a slug/dir name: "my-project" → "My Project". */
export function titleCase(input: string): string {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
