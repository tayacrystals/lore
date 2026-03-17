import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { VersionInfo } from "./types.ts";
import type { Config } from "./types.ts";

export async function detectVersions(docsDir: string): Promise<VersionInfo[]> {
  const entries = await readdir(docsDir);
  const versions: VersionInfo[] = [];

  for (const entry of entries) {
    const fullPath = path.join(docsDir, entry);
    const s = await stat(fullPath);

    if (s.isDirectory() && entry.startsWith("v")) {
      versions.push({ name: entry });
    }
  }

  return versions.sort((a, b) => {
    const numA = parseInt(a.name.slice(1), 10);
    const numB = parseInt(b.name.slice(1), 10);
    const numAIsNaN = isNaN(numA);
    const numBIsNaN = isNaN(numB);
    if (numAIsNaN && numBIsNaN) return a.name.localeCompare(b.name);
    if (numAIsNaN) return 1;
    if (numBIsNaN) return -1;
    return numA - numB;
  });
}

export function getDefaultVersion(config: Config): string {
  return config.defaultVersion ?? "latest";
}
