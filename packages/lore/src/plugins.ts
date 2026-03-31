import path from "node:path";
import { createRequire } from "node:module";
import type { Config } from "./types.ts";
import type { PageInfo, SidebarItem } from "./types.ts";

export interface FileSourceContext {
  /** Raw path segments from the docs root to the directory (e.g. ["versions"]). */
  pathParts: string[];
  /** Converts raw path segments to a URL slug (strips numeric prefixes, .mdx, etc.) */
  buildUrl: (parts: string[]) => string;
  currentLocale?: string;
  currentVersion?: string;
}

export interface FileSourceResult {
  pages: PageInfo[];
  sidebarItems: SidebarItem[];
}

export interface LorePlugin {
  name: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  components?: Record<string, unknown>;
  /**
   * Called for each directory encountered during walkDir.
   * Return a result to claim the directory (skips normal recursion).
   * Return null to let normal processing proceed.
   */
  fileSource?: (dir: string, ctx: FileSourceContext) => Promise<FileSourceResult | null>;
}

type PluginEntry = string | { name: string; options?: Record<string, unknown> };

export async function loadPlugins(docsDir: string, config: Config): Promise<LorePlugin[]> {
  if (!config.plugins || config.plugins.length === 0) return [];

  const plugins: LorePlugin[] = [];

  for (const entry of config.plugins as PluginEntry[]) {
    const [specifier, options] =
      typeof entry === "string"
        ? [entry, {}]
        : [entry.name, entry.options ?? {}];

    // Resolve the module from docsDir so that packages installed in the
    // docs project's node_modules are found, not lore's own node_modules.
    const require = createRequire(path.join(docsDir, "__placeholder__.js"));
    let resolved: string;
    try {
      resolved = specifier.startsWith("./") || specifier.startsWith("../")
        ? path.resolve(docsDir, specifier)
        : require.resolve(specifier);
    } catch (err) {
      console.warn(`[lore] Failed to resolve plugin "${specifier}": ${err}`);
      continue;
    }

    let mod: { default?: (opts: Record<string, unknown>) => LorePlugin };
    try {
      mod = await import(resolved);
    } catch (err) {
      console.warn(`[lore] Failed to load plugin "${specifier}": ${err}`);
      continue;
    }

    if (typeof mod.default !== "function") {
      console.warn(`[lore] Plugin "${specifier}" does not export a default function, skipping`);
      continue;
    }

    plugins.push(mod.default(options));
  }

  return plugins;
}
