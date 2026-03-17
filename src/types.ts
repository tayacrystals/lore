export interface Config {
  title?: string;
  description?: string;
  color?: string;
  links?: (string | { url: string; icon: string })[];
  plugins?: string[];
  versioning?: boolean;
  internationalization?: boolean;
  defaultVersion?: string;
  defaultLocale?: string;
}

export interface PageInfo {
  filePath: string;
  url: string;
  title: string;
  description?: string;
  content: string; // markdown content with frontmatter stripped
}

export interface SidebarPage {
  type: "page";
  title: string;
  url: string;
}

export interface SidebarSection {
  type: "section";
  title: string;
  url?: string; // set if the section has an index.mdx
  items: SidebarItem[];
}

export type SidebarItem = SidebarPage | SidebarSection;
