import type { SidebarEntry, SidebarItem } from "./sidebar";

export interface FlatNavItem {
  label: string;
  href: string;
}

export function flattenSidebar(entries: SidebarEntry[]): FlatNavItem[] {
  const result: FlatNavItem[] = [];
  for (const entry of entries) {
    if (entry.type === "link") {
      result.push({ label: entry.label, href: entry.href });
    } else {
      for (const item of entry.items) {
        result.push({ label: item.label, href: item.href });
      }
    }
  }
  return result;
}

export function getPrevNext(
  flatItems: FlatNavItem[],
  currentPath: string,
): { prev: FlatNavItem | null; next: FlatNavItem | null } {
  const normalized = currentPath.replace(/\/$/, "") || "/docs";
  const index = flatItems.findIndex((item) => item.href === normalized);

  return {
    prev: index > 0 ? flatItems[index - 1] : null,
    next: index < flatItems.length - 1 ? flatItems[index + 1] : null,
  };
}
