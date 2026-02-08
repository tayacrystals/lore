import type { CollectionEntry } from "astro:content";

export interface SidebarConfig {
  [group: string]: {
    label: string;
    order: number;
  };
}

export interface SidebarItem {
  type: "link";
  label: string;
  href: string;
  order: number;
}

export interface SidebarGroup {
  type: "group";
  label: string;
  order: number;
  slug: string;
  items: SidebarItem[];
}

export type SidebarEntry = SidebarItem | SidebarGroup;

export function buildSidebar(
  entries: CollectionEntry<"docs">[],
  sidebarGroups: SidebarConfig,
): SidebarEntry[] {
  const published = entries.filter((e) => !e.data.draft);
  const groups = new Map<string, SidebarItem[]>();
  const topLevel: SidebarItem[] = [];

  for (const entry of published) {
    const parts = entry.id.split("/");
    const href = entry.id === "index" ? "/docs" : `/docs/${entry.id}`;

    const item: SidebarItem = {
      type: "link",
      label: entry.data.title,
      href,
      order: entry.data.order,
    };

    if (parts.length > 1) {
      const groupSlug = parts[0];
      if (!groups.has(groupSlug)) {
        groups.set(groupSlug, []);
      }
      groups.get(groupSlug)!.push(item);
    } else {
      topLevel.push(item);
    }
  }

  const result: SidebarEntry[] = [];

  // Add top-level items (excluding index)
  for (const item of topLevel) {
    if (item.href !== "/docs") {
      result.push(item);
    }
  }

  // Add groups
  for (const [slug, items] of groups) {
    const config = sidebarGroups[slug];
    items.sort((a, b) => a.order - b.order);
    result.push({
      type: "group",
      label: config?.label ?? slug,
      order: config?.order ?? 999,
      slug,
      items,
    });
  }

  result.sort((a, b) => a.order - b.order);
  return result;
}
