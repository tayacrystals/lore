import type { BuildContext, LorePlugin } from '@loredocs/lore'

const SEARCH_INDEX_URL = '/__lore__/search-index.json'

export interface SearchOptions {
  /** Maximum characters of body text indexed per page. */
  maxExcerptLength?: number
}

/**
 * Default full-text search. Builds a JSON index of every renderable page
 * (title + description + plain-text body) and exposes it as a resource asset
 * consumed by the client search box. No external dependency — substring/token
 * scoring happens in the browser.
 */
export function search(options?: SearchOptions): LorePlugin {
  const maxLen = options?.maxExcerptLength ?? 4000
  return {
    name: 'lore:search',
    clientAssets(ctx) {
      const index = [...ctx.graph.pages.values()]
        .filter((p) => !p.hidden)
        .map((p) => ({
          title: p.title,
          description: p.description ?? '',
          text: toPlainText(p.body).slice(0, maxLen),
          url: p.url,
        }))
      return [
        {
          id: 'core:search-index',
          kind: 'resource',
          url: SEARCH_INDEX_URL,
          content: JSON.stringify(index),
        },
      ]
    },
  }
}

/** Strip markdown/MDX syntax down to searchable plain text. */
function toPlainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Keep the BuildContext import referenced for the hook signature's stability.
export type { BuildContext }
