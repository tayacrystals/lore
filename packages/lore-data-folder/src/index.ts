import path from "node:path";
import type { LorePlugin, FileSourceContext, FileSourceResult } from "@tayacrystals/lore/plugins";
import { parsePage } from "@tayacrystals/lore/parse";
import type { PageInfo, SidebarItem } from "@tayacrystals/lore/types";

function deriveSlug(entry: Record<string, unknown>): string {
  const val =
    entry["slug"] ??
    entry["id"] ??
    Object.values(entry).find((v) => typeof v === "string");
  return String(val ?? "entry")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fileSource(
  dir: string,
  ctx: FileSourceContext
): Promise<FileSourceResult | null> {
  const dataFile = Bun.file(path.join(dir, "data.json"));
  const tmplFile = Bun.file(path.join(dir, "template.mdx"));

  if (!(await dataFile.exists()) || !(await tmplFile.exists())) return null;

  let entries: unknown;
  try {
    entries = await dataFile.json();
  } catch {
    console.warn(`[lore-data-folder] Failed to parse data.json in ${dir}`);
    return null;
  }

  if (!Array.isArray(entries)) {
    console.warn(`[lore-data-folder] data.json in ${dir} is not an array, skipping`);
    return null;
  }

  const template = await tmplFile.text();
  const pages: PageInfo[] = [];
  const sidebarItems: SidebarItem[] = [];

  for (const entry of entries as Record<string, unknown>[]) {
    const content = template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => String(entry[key] ?? "")
    );
    const parsed = parsePage(content);
    const slug = deriveSlug(entry);
    const url = ctx.buildUrl([...ctx.pathParts, slug]);
    const title = parsed.h1Title ?? slug;

    pages.push({
      filePath: dir,
      url,
      title,
      description: parsed.description,
      content: parsed.content,
      context: {
        version: ctx.currentVersion,
        locale: ctx.currentLocale,
      },
    });

    sidebarItems.push({ type: "page", title, url });
  }

  return { pages, sidebarItems };
}

export default function dataFolder(_options: Record<string, unknown> = {}): LorePlugin {
  return {
    name: "lore-data-folder",
    fileSource,
  };
}
