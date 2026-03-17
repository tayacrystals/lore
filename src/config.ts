import yaml from "js-yaml";
import type { Config } from "./types.ts";

export async function loadConfig(docsDir: string): Promise<Config> {
  const file = Bun.file(`${docsDir}/lore.yml`);
  if (!(await file.exists())) return {};
  const text = await file.text();
  return (yaml.load(text) as Config) ?? {};
}

const NAMED_COLORS: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  gray: "#6b7280",
};

export function resolveColor(color?: string): string {
  if (!color) return "#3b82f6";
  return NAMED_COLORS[color] ?? color;
}
