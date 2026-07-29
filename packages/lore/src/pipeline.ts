import { collectAssets } from './asset.ts'
import { buildGraph } from './graph.ts'
import type { BuildContext, LoreConfig, LorePlugin, Page } from './types.ts'

/** Build a fresh context (graph empty until `runLoad` populates it). */
export async function createContext(opts: {
  command: 'build' | 'dev'
  root: string
  outDir: string
  config: LoreConfig
  plugins: LorePlugin[]
}): Promise<BuildContext> {
  return {
    command: opts.command,
    root: opts.root,
    outDir: opts.outDir,
    config: opts.config,
    graph: { pages: new Map(), rootIds: [] },
    plugins: opts.plugins,
    components: {},
    assets: [],
  }
}

/** Resolve and attach all assets (core + plugins) once the graph is built. */
export async function collectContextAssets(ctx: BuildContext): Promise<void> {
  ctx.assets = await collectAssets(ctx)
}

/** Phase 1–2: run every `load` hook, flatten results, and assemble the graph. */
export async function runLoad(ctx: BuildContext): Promise<void> {
  const collected: Page[] = []
  for (const plugin of ctx.plugins) {
    if (!plugin.load) continue
    const result = await plugin.load(ctx)
    if (Array.isArray(result)) collected.push(...result)
  }
  ctx.graph = buildGraph(dedupeById(collected))
}

/** Phase 3: run every `validate` hook. A throw fails the build. */
export async function runValidate(ctx: BuildContext): Promise<void> {
  for (const plugin of ctx.plugins) {
    await plugin.validate?.(ctx)
  }
}

/** Pick the active `renderBody` provider (the last plugin that defines one). */
export function pickRenderer(ctx: BuildContext): LorePlugin | undefined {
  for (let i = ctx.plugins.length - 1; i >= 0; i--) {
    if (ctx.plugins[i]?.renderBody) return ctx.plugins[i]
  }
  return undefined
}

function dedupeById(pages: Page[]): Page[] {
  const seen = new Map<string, Page>()
  for (const page of pages) {
    if (!seen.has(page.id)) seen.set(page.id, page)
  }
  return [...seen.values()]
}
