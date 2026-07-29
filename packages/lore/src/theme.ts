import type { LoreConfig } from './types.ts'

/** Named accent colors; anything else is treated as a raw CSS color. */
const ACCENTS: Record<string, string> = {
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  purple: '#9333ea',
  pink: '#db2777',
  red: '#dc2626',
  orange: '#ea580c',
  amber: '#d97706',
  yellow: '#ca8a04',
  green: '#16a34a',
  teal: '#0d9488',
  cyan: '#0891b2',
}

export function resolveAccent(config: LoreConfig): string {
  const c = config.color
  if (!c) return '#2563eb'
  return ACCENTS[c] ?? c
}

/**
 * Tiny config-derived `<style>` setting the accent tokens. Inlined in <head>
 * (before the theme stylesheet) because it's dynamic per-site and must apply
 * before first paint to avoid a flash.
 */
export function accentStyle(config: LoreConfig): string {
  const accent = resolveAccent(config)
  return `:root{--lore-accent:${accent};--lore-accent-soft:${accent}1a;}`
}
