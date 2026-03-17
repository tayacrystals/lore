import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parsePage, filenameToTitle } from "./parse.ts";
import type { PageInfo, SidebarItem } from "./types.ts";

export interface DocTree {
  pages: PageInfo[];
  sidebar: SidebarItem[];
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
function buildUrl(parts: string[]): string {
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
  return { filePath: url, url, title, content: lines.join("\n") };
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

export async function buildDocTree(docsDir: string): Promise<DocTree> {
  const pages: PageInfo[] = [];
  const sidebar: SidebarItem[] = [];
  await walkDir(docsDir, docsDir, [], pages, sidebar, true);
  return { pages, sidebar };
}

async function walkDir(
  docsDir: string,
  dir: string,
  pathParts: string[],
  pages: PageInfo[],
  sidebar: SidebarItem[],
  isRoot: boolean
): Promise<void> {
  const entries = sortEntries(await readdir(dir));

  for (const entry of entries) {
    if (entry === "lore.yml") continue;

    const fullPath = path.join(dir, entry);
    const s = await stat(fullPath);

    if (s.isDirectory()) {
      const sectionTitle = filenameToTitle(entry);
      const sectionItems: SidebarItem[] = [];
      const sectionPages: PageInfo[] = [];

      await walkDir(docsDir, fullPath, [...pathParts, entry], sectionPages, sectionItems, false);

      const sectionUrl = buildUrl([...pathParts, entry]);
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
