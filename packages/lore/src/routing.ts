import type { Config } from "./types.ts";

export interface RouteContext {
  version?: string;
  locale?: string;
  path: string;
}

export function parseUrl(url: string, config: Config): RouteContext {
  const parts = url.split("/").filter(Boolean);

  const ctx: RouteContext = { path: "" };

  if (config.internationalization && parts.length > 0) {
    const localeMatch = parts[0]!.match(/^[a-z]{2}(-[a-z]{2})?$/);
    if (localeMatch) {
      ctx.locale = parts.shift();
    }
  }

  if (config.versioning && parts.length > 0) {
    const versionMatch = parts[0]!.match(/^v\d+/);
    if (versionMatch) {
      ctx.version = parts.shift();
    }
  }

  ctx.path = parts.length > 0 ? "/" + parts.join("/") : "/";
  return ctx;
}

export function buildUrl(
  path: string,
  opts: { locale?: string; version?: string; baseUrl?: string }
): string {
  const parts: string[] = [];

  if (opts.baseUrl) parts.push(opts.baseUrl.replace(/^\//, "").replace(/\/$/, ""));
  if (opts.locale) parts.push(opts.locale);
  if (opts.version) parts.push(opts.version);

  const cleanPath = path.replace(/^\//, "").replace(/\/$/, "");
  if (cleanPath) parts.push(cleanPath);

  const result = "/" + parts.join("/");
  return result.replace(/\/+/g, "/");
}
