import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import rehypeExpressiveCode from 'rehype-expressive-code'
import type { LorePlugin } from '@loredocs/lore'

export interface ExpressiveCodeOptions {
  /** Color theme. Defaults to `github-dark`. */
  theme?: string
  /** Enable line numbers. Defaults to `false`. */
  lineNumbers?: boolean
  /** Enable collapsible sections. Defaults to `false`. */
  collapsibleSections?: boolean
}

/**
 * Syntax highlighting plugin using Expressive Code.
 *
 * Provides rich code block features:
 * - File names via `` ```ts title="app.ts" ``
 * - Editor & terminal frames
 * - Line highlighting (`// [\!code highlight]`)
 * - Diff markers (`// [\!code ++]`, `// [\!code --]`)
 * - Inline markers
 * - Copy to clipboard
 *
 * ```yml
 * plugins:
 *   - name: lore:expressive-code
 *     options:
 *       theme: github-light
 *       lineNumbers: true
 * ```
 */
export function expressiveCode(options?: ExpressiveCodeOptions): LorePlugin {
  const plugins = []
  if (options?.collapsibleSections) {
    plugins.push(pluginCollapsibleSections())
  }
  if (options?.lineNumbers) {
    plugins.push(pluginLineNumbers())
  }

  return {
    name: 'lore:expressive-code',
    rehypePlugins: [
      [
        rehypeExpressiveCode,
        {
          themes: [options?.theme ?? 'github-dark'],
          plugins,
          minSyntaxHighlightingColorContrast: 4.5,
          styleOverrides: {
            codeFontFamily:
              "'Berkeley Mono', 'Fira Code', 'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            codeFontSize: '0.875rem',
            borderColor: 'var(--lore-code-border)',
          },
        },
      ],
    ],
  }
}
