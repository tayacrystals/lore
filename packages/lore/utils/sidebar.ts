import type { CollectionEntry } from "astro:content";
import type { SidebarGroupConfig } from "../config";

const BASE_URL = import.meta.env.BASE_URL || "/";

export interface SidebarItem {
  type: "link";
  label: string;
  href: string;
  order: number;
  icon?: string;
}

export interface SidebarGroup {
  type: "group";
  label: string;
  order: number;
  slug: string;
  items: SidebarEntry[];
}

export type SidebarEntry = SidebarItem | SidebarGroup;

function titleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildSidebar(
  entries: CollectionEntry<"docs">[],
  sidebarConfig: Record<string, SidebarGroupConfig>,
): SidebarEntry[] {
  const published = entries.filter((e) => !e.data.draft);
  return buildLevel(published, sidebarConfig, "", 0);
}

function buildLevel(
  entries: CollectionEntry<"docs">[],
  configAtLevel: Record<string, SidebarGroupConfig>,
  prefix: string,
  depth: number,
): SidebarEntry[] {
  const groups = new Map<string, CollectionEntry<"docs">[]>();
  const topLevel: SidebarItem[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? entry.id.slice(prefix.length + 1) : entry.id;
    const parts = relativePath.split("/");

    if (parts.length > 1) {
      const groupSlug = parts[0];
      if (!groups.has(groupSlug)) {
        groups.set(groupSlug, []);
      }
      groups.get(groupSlug)!.push(entry);
    } else {
      const href = entry.id === "index" ? `${BASE_URL}docs` : `${BASE_URL}docs/${entry.id}`;
      topLevel.push({
        type: "link",
        label: entry.data.title,
        href,
        order: entry.data.order,
        icon: entry.data.icon,
      });
    }
  }

  const result: SidebarEntry[] = [];

  // Add top-level items (excluding index at root level only)
  for (const item of topLevel) {
    if (depth === 0 && item.href === "/docs") continue;
    result.push(item);
  }

  // Add groups (recursively)
  for (const [slug, groupEntries] of groups) {
    const fullSlug = prefix ? `${prefix}/${slug}` : slug;
    const config = configAtLevel[slug];
    const childConfig = config?.children ?? {};

    const items = buildLevel(groupEntries, childConfig, fullSlug, depth + 1);
    items.sort((a, b) => a.order - b.order);

    result.push({
      type: "group",
      label: config?.label ?? titleCase(slug),
      order: config?.order ?? 999,
      slug: fullSlug,
      items,
    });
  }

  result.sort((a, b) => a.order - b.order);
  return result;
}
