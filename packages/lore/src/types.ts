/**
 * Lore core types.
 *
 * The build pipeline runs in five phases (see docs/03-architecture.mdx):
 *   load plugins → build content graph → validate content → render content → emit output
 *
 * Most built-in behaviour is provided by default plugins registered into the
 * pipeline; the filesystem content loader is itself just another plugin.
 */

/** User-facing site configuration, loaded from `lore.yml`. */
export interface LoreConfig {
  /** Site title. Defaults to the docs directory name. */
  title: string
  /** Short site description (used in <meta> and landing pages). */
  description?: string
  /** Accent / theme color. Any valid CSS color or a named theme token. */
  color?: string
  /** Path (relative to docs root) to a logo image. */
  logo?: string
  /** Public base URL, used for canonical links / sitemap / Open Graph. */
  baseUrl?: string
  /** Path prefix for sub-path hosting, extracted from `baseUrl`. */
  basePath: string
  /** Ordered list of plugin specs. Default plugins always run first. */
  plugins?: PluginSpec[]
  /** Output directory (relative to CWD). Defaults to `dist`. */
  outDir?: string
  /** Theme: `light` | `dark` | `auto`. Defaults to `auto`. */
  theme?: 'light' | 'dark' | 'auto'
  /** Minify HTML output. Defaults to `true` for `build`, `false` for `dev`. */
  minify?: boolean
  /** Per-page frontmatter defaults applied on top of file frontmatter. */
  frontmatterDefaults?: Frontmatter
  /** Directories to exclude from the built site, as paths relative to the docs root. Matches exactly or as a prefix — "external" excludes the whole subtree. */
  exclude?: string[]
  /** Arbitrary extra fields are preserved for plugins. */
  [key: string]: unknown
}

/**
 * How a plugin is referenced in `lore.yml`.
 *
 * - string: a package name (`lore-plugin-xyz`) or a local path (`./my-plugin.ts`)
 * - object: the same, plus an `options` map passed to the plugin factory
 * - a plugin instance already (handy for the programmatic API)
 */
export type PluginSpec = string | { name: string; options?: Record<string, unknown> } | LorePlugin

/** Per-page YAML frontmatter. */
export type Frontmatter = Record<string, unknown>

/** A single page (or section) in the content graph. */
export interface Page {
  /** Stable unique id, also the graph key (the page's slug path). */
  id: string
  /** Output route, e.g. `/guides/quick-start`. Root index is `/`. */
  url: string
  /** Display title. Inferred from filename / leading h1 / frontmatter. */
  title: string
  /** One-line description (frontmatter `description`). */
  description?: string
  /** Parsed YAML frontmatter. */
  frontmatter: Frontmatter
  /** Raw source body (MDX text). Empty for synthetic directory listings. */
  body: string
  /** Absolute filesystem path of the source file, when loaded from disk. */
  sourcePath?: string
  /** True when this node represents a directory/section. */
  isSection: boolean
  /** Sort key among siblings (numeric prefix, then name). */
  order: number
  /** Parent page id, or null at the top level. */
  parentId: string | null
  /** Ordered child page ids. */
  childIds: string[]
  hidden?: boolean
  /** Synthetic pages are generated (e.g. directory listings), not from a file. */
  synthetic?: boolean
}

/** The full content graph: pages keyed by id, plus ordered top-level roots. */
export interface ContentGraph {
  pages: Map<string, Page>
  rootIds: string[]
}

/** Shared state threaded through every pipeline hook. */
export interface BuildContext {
  /** Which command invoked the build. */
  command: 'build' | 'dev'
  /** Absolute path to the docs root. */
  root: string
  /** Absolute path to the output directory. */
  outDir: string
  /** Resolved site configuration. */
  config: LoreConfig
  /** The content graph (mutated during the load phase). */
  graph: ContentGraph
  /** Resolved plugin instances, in run order. */
  plugins: LorePlugin[]
  /** MDX component overrides contributed by plugins (rendered into pages). */
  components: Record<string, unknown>
  /** All resolved assets (core + plugins), ordered, ready to serve/emit. */
  assets: Asset[]
}

/**
 * A Lore plugin. Most fields are optional hooks; a plugin implements only what
 * it needs. Default plugins (`filesystem`, `mdx`, `search`) are registered
 * automatically before user plugins.
 */
export interface LorePlugin {
  /** Unique plugin name. */
  name: string
  /** Phase 1 — contribute source pages to the graph. */
  load?(ctx: BuildContext): Page[] | Promise<Page[] | undefined> | undefined
  /** Phase 2 — validate the graph; throw to fail the build. */
  validate?(ctx: BuildContext): void | Promise<void>
  /** Phase 3 — render a page body to inner HTML. The last provider wins. */
  renderBody?(page: Page, ctx: BuildContext): string | Promise<string>
  /** Phase 4 — transform the full HTML document for a page. */
  transformHtml?(page: Page, html: string, ctx: BuildContext): string | Promise<string>
  /** Contribute client-side assets (inline scripts / styles). */
  clientAssets?(ctx: BuildContext): Asset[] | Promise<Asset[]>
  /** Extra remark plugins applied during MDX compilation. */
  remarkPlugins?: unknown[]
  /** Extra rehype plugins applied during MDX compilation. */
  rehypePlugins?: unknown[]
  /** Register Preact components usable from MDX. */
  components?: Record<string, unknown>
}

/** A plugin is produced by a factory that receives its options. */
export type PluginFactory<TOptions = Record<string, unknown>> = (options?: TOptions) => LorePlugin

/**
 * A client/build asset contributed by the core or a plugin.
 *
 * An asset is either backed by a file (`source`), inline text (`content`),
 * or both. It is served at `url` (dev) and emitted to `dist` (build), then
 * referenced from the document — unless `inline` is set, in which case its
 * content is injected directly into the HTML.
 */
export interface Asset {
  /** Dedupe key. Two assets with the same id collapse to the first. */
  id: string
  /** How the asset is linked: styles go in <head>, scripts before </body>. */
  kind: 'style' | 'script' | 'resource'
  /** Absolute path to a source file on disk. */
  source?: string
  /** Inline source text (used when `source` is absent, or always for inline). */
  content?: string
  /** Public URL to serve/emit at. Auto-assigned if omitted. */
  url?: string
  /** Link order within its kind (lower first). Core defaults to 0. */
  order?: number
  /** Inject content directly into HTML instead of referencing `url`. */
  inline?: boolean
}
