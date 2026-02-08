export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export const topNav: NavLink[] = [
  { label: "Docs", href: "/docs" },
  { label: "Guides", href: "/docs/guides/writing-content" },
];

export interface SidebarConfig {
  [group: string]: {
    label: string;
    order: number;
  };
}

export const sidebarGroups: SidebarConfig = {
  "getting-started": {
    label: "Getting Started",
    order: 1,
  },
  guides: {
    label: "Guides",
    order: 2,
  },
};
