import yaml from "js-yaml";
import type { Config } from "./types.ts";

export async function loadConfig(docsDir: string): Promise<Config> {
  const file = Bun.file(`${docsDir}/lore.yml`);
  if (!(await file.exists())) return {};
  const text = await file.text();
  return (yaml.load(text) as Config) ?? {};
}

// WCAG AA compliant colors (≥4.5:1 contrast on white)
const NAMED_COLORS: Record<string, string> = {
  red: "#b91c1c",
  orange: "#c2410c",
  yellow: "#a16207",
  green: "#15803d",
  blue: "#1d4ed8",
  purple: "#6d28d9",
  pink: "#be185d",
  gray: "#374151",
};

export function resolveColor(color?: string): string {
  if (!color) return "#1d4ed8";
  return NAMED_COLORS[color] ?? color;
}
