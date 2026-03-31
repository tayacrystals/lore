import * as lucide from "lucide";

type IconData = [string, Record<string, string>][];

function iconDataToSvg(data: IconData): string {
  const children = data
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${attrStr}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

/** kebab-case → PascalCase, e.g. "message-circle" → "MessageCircle" */
function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Render a named Lucide icon (kebab-case) to an SVG string, or null if not found. */
export function lucideIcon(name: string): string | null {
  const key = toPascalCase(name);
  const data = (lucide as Record<string, unknown>)[key];
  if (!Array.isArray(data)) return null;
  return iconDataToSvg(data as IconData);
}

const fallback = () => lucideIcon("external-link") ?? "";

// Brand icons not in Lucide
const DISCORD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`;

/** Pick an icon SVG for a URL based on its domain. */
export function serviceIcon(url: string): string {
  if (url.includes("github.com")) return lucideIcon("github") ?? fallback();
  if (url.includes("npmjs.com")) return lucideIcon("package") ?? fallback();
  if (url.includes("twitter.com") || url.includes("x.com")) return lucideIcon("twitter") ?? fallback();
  if (url.includes("discord.com") || url.includes("discord.gg")) return DISCORD_SVG;
  if (url.includes("slack.com")) return lucideIcon("slack") ?? fallback();
  if (url.includes("youtube.com") || url.includes("youtu.be")) return lucideIcon("youtube") ?? fallback();
  if (url.includes("linkedin.com")) return lucideIcon("linkedin") ?? fallback();
  return fallback();
}

/** Get icon SVG for a link config entry. */
export function linkIcon(link: string | { url: string; icon: string }): string {
  if (typeof link === "string") return serviceIcon(link);
  return lucideIcon(link.icon) ?? serviceIcon(link.url);
}

/** Get the href for a link config entry. */
export function linkHref(link: string | { url: string; icon: string }): string {
  return typeof link === "string" ? link : link.url;
}
