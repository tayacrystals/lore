export interface TocItem {
  depth: number;
  slug: string;
  text: string;
  children: TocItem[];
}

export interface MarkdownHeading {
  depth: number;
  slug: string;
  text: string;
}

export function buildToc(headings: MarkdownHeading[]): TocItem[] {
  const filtered = headings.filter((h) => h.depth >= 2 && h.depth <= 3);
  const result: TocItem[] = [];

  for (const heading of filtered) {
    const item: TocItem = { ...heading, children: [] };
    if (heading.depth === 2) {
      result.push(item);
    } else if (result.length > 0) {
      result[result.length - 1].children.push(item);
    }
  }

  return result;
}
