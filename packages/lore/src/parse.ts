export interface ParsedPage {
  frontmatter: Record<string, unknown>;
  content: string;
  h1Title?: string;
  description?: string;
}

/**
 * Parse an MDX file: extract frontmatter and content.
 */
export function parsePage(raw: string): ParsedPage {
  let content = raw;
  let frontmatter: Record<string, unknown> = {};

  // Strip frontmatter
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) {
      const fmText = content.slice(3, end).trim();
      if (fmText) {
        frontmatter = (Bun.YAML.parse(fmText) as Record<string, unknown>) ?? {};
      }
      content = content.slice(end + 4).trimStart();
    }
  }

  // Extract leading H1 if present
  let h1Title: string | undefined;
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match && content.trimStart().startsWith("#")) {
    h1Title = h1Match[1]?.trim();
  }

  const description =
    typeof frontmatter["description"] === "string"
      ? frontmatter["description"]
      : undefined;

  return { frontmatter, content, h1Title, description };
}

/**
 * Derive a title from a filename (without extension, without numeric prefix).
 * e.g. "01-quick-start" → "Quick Start"
 */
export function filenameToTitle(name: string): string {
  return name
    .replace(/^\d+-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
