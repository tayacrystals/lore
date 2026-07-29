import { accentStyle } from './theme.ts'
import type { Asset, BuildContext } from './types.ts'

/** URL namespace for Lore's own + plugin-contributed assets. */
export const ASSET_BASE = '/__lore__'

const ASSETS_DIR = `${import.meta.dir}/assets`

/**
 * Collect every asset for a build: core assets first (accent, theme, client,
 * dev-only reload), then each plugin's `clientAssets`. Assigns URLs, dedupes
 * by id, and sorts styles/scripts by `order`.
 */
export async function collectAssets(ctx: BuildContext): Promise<Asset[]> {
  const collected: Asset[] = [
    {
      id: 'core:accent',
      kind: 'style',
      inline: true,
      order: -100,
      content: accentStyle(ctx.config),
    },
    {
      id: 'core:theme',
      kind: 'style',
      order: 0,
      source: `${ASSETS_DIR}/theme.css`,
      url: `${ASSET_BASE}/theme.css`,
    },
    {
      id: 'core:client',
      kind: 'script',
      order: 0,
      source: `${ASSETS_DIR}/client.ts`,
      url: `${ASSET_BASE}/client.js`,
    },
  ]

  if (ctx.command === 'dev') {
    collected.push({
      id: 'core:reload',
      kind: 'script',
      order: 100,
      url: `${ASSET_BASE}/reload.js`,
      content: reloadScript(ctx.config.basePath),
    })
  }

  for (const plugin of ctx.plugins) {
    if (!plugin.clientAssets) continue
    const contributed = await plugin.clientAssets(ctx)
    for (const asset of contributed) {
      collected.push({ ...asset, id: asset.id || `${plugin.name}:${collected.length}` })
    }
  }

  return finalize(collected)
}

/** Read an asset's bytes: inline content wins, otherwise the source file.
 *  Transpiles .ts sources to JavaScript automatically. */
export async function readAsset(asset: Asset): Promise<string> {
  if (asset.content !== undefined) return asset.content
  if (asset.source) {
    const file = Bun.file(asset.source)
    if (await file.exists()) {
      const text = await file.text()
      if (asset.source.endsWith('.ts')) {
        const transpiler = new Bun.Transpiler({ loader: 'ts', target: 'browser' })
        return transpiler.transformSync(text)
      }
      return text
    }
  }
  return ''
}

/** Index assets by their URL for O(1) dev-server lookup. */
export function indexByUrl(assets: Asset[]): Map<string, Asset> {
  const map = new Map<string, Asset>()
  for (const asset of assets) if (asset.url) map.set(asset.url, asset)
  return map
}

/** Assets that should be linked into the document (exclude bare resources). */
export function linkableAssets(assets: Asset[]): { styles: Asset[]; scripts: Asset[] } {
  const styles = assets.filter((a) => a.kind === 'style').sort(byOrder)
  const scripts = assets.filter((a) => a.kind === 'script').sort(byOrder)
  return { styles, scripts }
}

function finalize(assets: Asset[]): Asset[] {
  const byId = new Map<string, Asset>()
  for (const asset of assets) {
    if (byId.has(asset.id)) continue
    byId.set(asset.id, { ...asset, url: asset.url ?? defaultUrl(asset) })
  }
  return [...byId.values()]
}

function defaultUrl(asset: Asset): string {
  const ext = asset.kind === 'style' ? '.css' : asset.kind === 'script' ? '.js' : ''
  const safe = asset.id.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${ASSET_BASE}/assets/${safe}${ext}`
}

function byOrder(a: Asset, b: Asset): number {
  return (a.order ?? 0) - (b.order ?? 0)
}

function reloadScript(basePath: string): string {
  const sseUrl = basePath ? `${basePath}/__lore__/reload` : '/__lore__/reload'
  return [
    '(function(){',
    '  function connect(){',
    `    var es = new EventSource("${sseUrl}");`,
    '    es.addEventListener("reload", function(){ location.reload(); });',
    '    es.onerror = function(){ setTimeout(connect, 1500); };',
    '  }',
    '  connect();',
    '})();',
  ].join('\n')
}
