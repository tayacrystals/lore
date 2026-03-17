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

export interface VersionInfo {
  name: string;
  label?: string;
}

export interface LocaleInfo {
  code: string;
  label?: string;
}

export interface PageContext {
  version?: string;
  locale?: string;
  translationOf?: string;
}

export interface PageInfo {
  filePath: string;
  url: string;
  title: string;
  description?: string;
  content: string;
  context: PageContext;
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
