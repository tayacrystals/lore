# Lore — TODO

## Done
- [x] AI agent support plugin — emit `.md` versions of pages, `llms.txt`, and advertise them via `<link rel="alternate" type="text/markdown">`
- [x] rename package namespace from `@lore` to `@loredocs`
- [x] basePath not applied to markdown body links — body HTML is now prefixed in `render.tsx` (`prefixBodyUrls`), so content links work under sub-path hosting
- [x] basePath not applied by ai-agent — `<link rel="alternate">` and all `llms.txt` / `llms-full.txt` links are now prefixed (emitted file paths stay unprefixed, like all assets)
- [x] dev watcher hardcoded `dist` — now excludes the resolved `outDir`; also guards against stacking multiple polling fallbacks
- [x] dev server never re-ran `validate` after a file change — `rebuild()` now includes it, so dead-link checking works live
- [x] speculation rules prefetched external links — restricted to same-origin via `href_matches` patterns, query-string URLs excluded
- [x] `minifyCss` corrupted string literals (`content: "a; b"`) and stripped `/*!` license comments — rewritten as a string/comment-aware scanner
- [x] `serve`/`dev` didn't decode percent-encoded request paths — static files with spaces/unicode names 404'd
- [x] hidden `ArrowIcon` span emitted into every page — removed
- [x] `BuildContext.components` was dead state (never read anywhere) — removed from the interface
- [x] redirect stub pages (`/` under versioning/i18n) polluted the core search index — synthetic pages without body/description are now skipped
- [x] collections sort was always string-compare — numeric fields sort numerically, strings use `numeric: true`
- [x] orphan pages (parentId pointing nowhere) silently vanished from nav — `runLoad` now warns
- [x] `versioning: {}` / `i18n: {}` (no payload) skipped the filesystem plugin and produced an empty site — defaults now only skip when locales/versions arrays actually exist
- [x] `<html lang>` hardcoded to `"en"` — new `lang` config option; i18n replaces whatever lang is set
- [x] expressive-code docstring showed an unresolvable plugin name (`lore:expressive-code`)

## Pending — needs a decision

### Configuring or disabling default plugins
`plugin-loader.ts` always instantiates `mdx()`, `search()`, `expressiveCode()`, etc. with no options, and they can neither be configured nor removed from `lore.yml`. Re-listing them in `plugins:` creates a *second* instance (EC would double-process code blocks; `search` options are silently ignored due to the shared `core:search-index` asset id). The docs acknowledge removal isn't possible but configuration is effectively broken too.
**Options:** (a) name-based dedup — a config entry whose resolved plugin `name` matches a default replaces that default; (b) namespaced config keys (`expressiveCode: {...}`, `search: {...}`) like `versioning`/`i18n` already do; (c) `plugins: { mdx: false }` to disable. Probably (a) + (c).

### Sitemap.xml / robots.txt
`types.ts` documents `baseUrl` as "used for canonical links / sitemap / Open Graph" — canonical links and OG exist, but no sitemap is generated anywhere. Straightforward once we decide: always emit when `baseUrl` is set? Add `sitemap: false` opt-out? Same question for robots.txt.

### Custom 404 page
`serve` and `dev` return plain-text "Not found"; no `404.html` is emitted, so GitHub Pages / nginx fallbacks show nothing useful. Decide: emit a themed `404.html` from the layout always, or only when a `404.mdx` source exists?

### `outDir` resolves against CWD, not the docs root
`config.ts:resolveOutDir` uses `process.cwd()`, so `lore build docs` from a parent directory writes `dist/` into the parent. Documented behavior, but surprising for the `lore <cmd> <dir>` CLI shape. Changing it to docs-root-relative alters existing behavior (monorepo workflows may rely on CWD-relative output). Needs a call, possibly with a major version.

### Expressive Code dual themes
The site has a light/dark toggle, but EC is configured with a single theme (`github-dark`), so code blocks stay dark in light mode. EC supports `themes: { light, dark }` with CSS variables. Decide: default to a light+dark pair when `theme` option is unset, and/or add `themeLight`/`themeDark` options.

### Bare package-name plugin resolution
`plugin-loader.ts` resolves path-like specs (`./x.ts`, `/abs`) against the docs root, but bare package names import relative to lore's own location. Under `bunx @loredocs/lore`, that resolves against the bunx cache — user plugins installed in the project's `node_modules` likely won't be found. Needs verification and a fix (e.g. create a temp entry from `ctx.root` or use `createRequire(ctx.root)`-style resolution).

### og:url / og:image / twitter cards
OG meta is partial (`og:title`, `og:type`, `og:description`). Decide whether to add `og:url` (from `baseUrl` + page url), an `ogImage` config option, and whether twitter card meta is in scope at all.

### RSS/Atom for collections
Collections already look blog-shaped (dates, `sort`, `perPage`), but there's no feed. Decide: a `rss: true` collection flag, a separate plugin, or out of scope.

### Search hotkey + result excerpts
No `/` or `Cmd+K` shortcut to focus search, and results show only title/description (no matched-text snippet). Both are UX polish; decide whether they belong in core or in the search plugin's client bundle.

### Consolidate the three markdown strippers
`plugin-search:toPlainText`, `plugin-i18n:stripMarkdown`, and `plugin-ai-agent`'s fallback stripping all differ. ai-agent deliberately renders real markdown via its JSX runtime; the other two are regex-based. Decide whether to export one canonical stripper from core or leave them purpose-specific.

### Semver policy for the `BuildContext` removal
`BuildContext.components` was removed (dead field). Exported types are public API for plugin authors — decide whether this ships in a patch/minor or waits for the next major.
