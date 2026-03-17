import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { LocaleInfo } from "./types.ts";
import type { Config } from "./types.ts";

export async function detectLocales(docsDir: string): Promise<LocaleInfo[]> {
  const entries = await readdir(docsDir);
  const locales: LocaleInfo[] = [];

  for (const entry of entries) {
    const fullPath = path.join(docsDir, entry);
    const s = await stat(fullPath);

    if (s.isDirectory() && /^[a-z]{2}(-[a-z]{2})?$/.test(entry)) {
      locales.push({ code: entry });
    }
  }

  return locales.sort((a, b) => a.code.localeCompare(b.code));
}

export function getDefaultLocale(config: Config): string {
  return config.defaultLocale ?? "en";
}

export function getLocaleLabel(code: string): string {
  const labels: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    ja: "日本語",
    zh: "中文",
    ko: "한국어",
    pt: "Português",
    ru: "Русский",
    it: "Italiano",
    nl: "Nederlands",
    pl: "Polski",
    tr: "Türkçe",
    ar: "العربية",
    hi: "हिन्दी",
    vi: "Tiếng Việt",
    th: "ไทย",
    id: "Bahasa Indonesia",
    ms: "Bahasa Melayu",
  };
  return labels[code] ?? code.toUpperCase();
}
