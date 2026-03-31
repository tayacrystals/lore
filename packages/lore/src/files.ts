import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parsePage, filenameToTitle } from "./parse.ts";
import type { PageInfo, SidebarItem, VersionInfo, LocaleInfo } from "./types.ts";
import { loadConfig } from "./config.ts";
import { detectVersions, getDefaultVersion } from "./version.ts";
import { detectLocales, getDefaultLocale } from "./i18n.ts";
import type { LorePlugin } from "./plugins.ts";

export interface DocTree {
  pages: PageInfo[];
  sidebar: SidebarItem[];
  versions?: VersionInfo[];
  locales?: LocaleInfo[];
  currentVersion?: string;
  currentLocale?: string;
}

/** Strip numeric prefix: "01-configuration" → "configuration" */
function stripPrefix(name: string): string {
  return name.replace(/^\d+-/, "");
}

/** Convert a filename (with .mdx) to a URL slug */
function toSlug(filename: string): string {
  return stripPrefix(filename.replace(/\.mdx$/, ""));
}

/** Build the URL from a list of path parts relative to docs dir */
export function buildUrl(parts: string[]): string {
  const segments = parts.map((p) => toSlug(p));
  const filtered = segments.filter((s) => s !== "index");
  if (filtered.length === 0) return "/";
  return "/" + filtered.join("/");
}

function generateListing(title: string, url: string, items: SidebarItem[]): PageInfo {
  const lines = [`# ${title}`, ""];
  for (const item of items) {
    const href = item.type === "page" ? item.url : (item.url ?? "#");
    lines.push(`- [${item.title}](${href})`);
  }
  return { filePath: url, url, title, content: lines.join("\n"), context: {} };
}

/** Sort entries: index.mdx first, then alphabetically */
function sortEntries(entries: string[]): string[] {
  return entries.sort((a, b) => {
    const aIsIndex = a === "index.mdx";
    const bIsIndex = b === "index.mdx";
    if (aIsIndex && !bIsIndex) return -1;
    if (!aIsIndex && bIsIndex) return 1;
    return a.localeCompare(b);
  });
}

export async function buildDocTree(
  docsDir: string,
  opts: {
    version?: string;
    locale?: string;
    plugins?: LorePlugin[];
  } = {}
): Promise<DocTree> {
  const config = await loadConfig(docsDir);
  const hasVersioning = config.versioning;
  const hasI18n = config.internationalization;

  let versions: VersionInfo[] = [];
  let locales: LocaleInfo[] = [];

  if (hasI18n) {
    locales = await detectLocales(docsDir);
  }

  if (hasVersioning) {
    if (hasI18n && locales.length > 0) {
      const locale = opts.locale ?? getDefaultLocale(config);
      const localeDir = path.join(docsDir, locale);
      versions = await detectVersions(localeDir);
    } else {
      versions = await detectVersions(docsDir);
    }
  }

  let contentDir = docsDir;
  let currentVersion: string | undefined;
  let currentLocale: string | undefined;

  if (hasI18n) {
    currentLocale = opts.locale ?? getDefaultLocale(config);
    contentDir = path.join(contentDir, currentLocale);
  }

  if (hasVersioning) {
    currentVersion = opts.version ?? getDefaultVersion(config);
    contentDir = path.join(contentDir, currentVersion);
  }

  const pages: PageInfo[] = [];
  const sidebar: SidebarItem[] = [];

  await walkDir(
    docsDir,
    contentDir,
    [],
    pages,
    sidebar,
    true,
    currentLocale,
    currentVersion,
    opts.plugins ?? []
  );

  return {
    pages,
    sidebar,
    versions: versions.length > 0 ? versions : undefined,
    locales: locales.length > 0 ? locales : undefined,
    currentVersion,
    currentLocale,
  };
}

async function walkDir(
  docsDir: string,
  dir: string,
  pathParts: string[],
  pages: PageInfo[],
  sidebar: SidebarItem[],
  isRoot: boolean,
  currentLocale?: string,
  currentVersion?: string,
  plugins: LorePlugin[] = []
): Promise<void> {
  const entries = sortEntries(await readdir(dir));

  for (const entry of entries) {
    if (entry === "lore.yml" || entry === "node_modules" || entry.startsWith(".")) continue;

    const fullPath = path.join(dir, entry);
    const s = await stat(fullPath);

    if (s.isDirectory()) {
      const sectionTitle = filenameToTitle(entry);
      const sectionUrl = buildUrl([...pathParts, entry]);

      // Give plugins a chance to handle this directory before normal recursion
      let handled = false;
      for (const plugin of plugins) {
        if (!plugin.fileSource) continue;
        const result = await plugin.fileSource(fullPath, {
          pathParts: [...pathParts, entry],
          buildUrl,
          currentLocale,
          currentVersion,
        });
        if (result) {
          const hasIndex = result.pages.some((p) => p.url === sectionUrl);
          if (!hasIndex) {
            result.pages.push(generateListing(sectionTitle, sectionUrl, result.sidebarItems));
          }
          pages.push(...result.pages);
          sidebar.push({ type: "section", title: sectionTitle, url: sectionUrl, items: result.sidebarItems });
          handled = true;
          break;
        }
      }

      if (!handled) {
        const sectionItems: SidebarItem[] = [];
        const sectionPages: PageInfo[] = [];

        await walkDir(docsDir, fullPath, [...pathParts, entry], sectionPages, sectionItems, false, currentLocale, currentVersion, plugins);

        const hasIndex = sectionPages.some((p) => p.url === sectionUrl);

        // Auto-generate a directory listing page if there's no explicit index.mdx
        if (!hasIndex) {
          sectionPages.push(generateListing(sectionTitle, sectionUrl, sectionItems));
        }

        pages.push(...sectionPages);

        sidebar.push({
          type: "section",
          title: sectionTitle,
          url: sectionUrl,
          items: sectionItems,
        });
      }
    } else if (entry.endsWith(".mdx")) {
      const url = buildUrl([...pathParts, entry]);
      const raw = await Bun.file(fullPath).text();
      const parsed = parsePage(raw);
      const baseName = entry.replace(/\.mdx$/, "");
      const title = parsed.h1Title ?? filenameToTitle(baseName);

      const page: PageInfo = {
        filePath: fullPath,
        url,
        title,
        description: parsed.description,
        content: parsed.content,
        context: {
          version: currentVersion,
          locale: currentLocale,
          translationOf: parsed.frontmatter["translation-of"] as string | undefined,
        },
      };
      pages.push(page);

      const isIndex = toSlug(entry) === "index";
      // Root index.mdx goes into sidebar; subdirectory index.mdx is shown
      // via the section header link and not as a separate sidebar item.
      if (!isIndex || isRoot) {
        const sidebarTitle = isRoot && isIndex ? "Home" : title;
        sidebar.push({ type: "page", title: sidebarTitle, url });
      }
    }
  }
}
