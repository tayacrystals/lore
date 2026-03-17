import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { renderMdx } from "./mdx.ts";
import { loadConfig } from "./config.ts";
import { buildDocTree } from "./files.ts";
import { renderPage } from "./template.ts";
import { detectVersions, getDefaultVersion } from "./version.ts";
import { detectLocales, getDefaultLocale } from "./i18n.ts";

async function findLogo(docsDir: string, outDir: string): Promise<string | undefined> {
  for (const name of ["logo.svg", "logo.png"]) {
    const src = Bun.file(`${docsDir}/${name}`);
    if (await src.exists()) {
      await Bun.write(`${outDir}/${name}`, src);
      return `/${name}`;
    }
  }
}

export async function build(
  docsDir: string,
  outDir: string,
  opts: { devMode?: boolean } = {}
): Promise<void> {
  console.log(`Building docs from ${docsDir} → ${outDir}`);

  // Clear build directory first to avoid merging old and new artifacts
  try {
    await rm(outDir, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, which is fine
  }

  const config = await loadConfig(docsDir);
  const logoSrc = await findLogo(docsDir, outDir);

  const hasVersioning = config.versioning;
  const hasI18n = config.internationalization;

  const builds: Array<{ version?: string; locale?: string }> = [];

  if (hasI18n) {
    const locales = await detectLocales(docsDir);
    for (const locale of locales) {
      if (hasVersioning) {
        const localeDir = path.join(docsDir, locale.code);
        const versions = await detectVersions(localeDir);
        for (const version of versions) {
          builds.push({ locale: locale.code, version: version.name });
        }
      } else {
        builds.push({ locale: locale.code });
      }
    }
  } else if (hasVersioning) {
    const versions = await detectVersions(docsDir);
    for (const version of versions) {
      builds.push({ version: version.name });
    }
  }

  if (builds.length === 0) {
    builds.push({});
  }

  let totalPages = 0;

  for (const buildOpts of builds) {
    const { pages, sidebar, versions, locales, currentVersion, currentLocale } =
      await buildDocTree(docsDir, buildOpts);

    const buildLabel = [
      currentLocale,
      currentVersion,
    ].filter(Boolean).join("/") || "default";

    console.log(`Building for ${buildLabel}: found ${pages.length} pages`);

    for (const page of pages) {
      const contentHtml = await renderMdx(page.content, {
        locale: currentLocale,
        version: currentVersion,
      });

      const html = renderPage({
        config,
        title: page.title,
        description: page.description,
        contentHtml,
        sidebar,
        currentUrl: page.url,
        logoSrc,
        devMode: opts.devMode,
        versions,
        locales,
        currentVersion,
        currentLocale,
        translationOf: page.context.translationOf,
      });

      const urlParts: string[] = [];
      if (currentLocale) urlParts.push(currentLocale);
      if (currentVersion) urlParts.push(currentVersion);

      const urlSegments = page.url.split("/").filter(Boolean);

      let outputPath: string;
      if (urlSegments.length === 0) {
        outputPath = path.join(outDir, ...urlParts, "index.html");
      } else {
        outputPath = path.join(outDir, ...urlParts, ...urlSegments, "index.html");
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, html);
      console.log(`  ${page.url} → ${path.relative(process.cwd(), outputPath)}`);
      totalPages++;
    }
  }

  const defaultLocale = config.internationalization
    ? config.defaultLocale ?? "en"
    : undefined;
  const defaultVersion = config.versioning
    ? config.defaultVersion ?? "latest"
    : undefined;

  const redirectPathParts: string[] = [];
  if (defaultLocale) redirectPathParts.push(defaultLocale);
  if (defaultVersion) redirectPathParts.push(defaultVersion);

  if (redirectPathParts.length > 0 && totalPages > 0) {
    const redirectPath = "/" + redirectPathParts.join("/") + "/";
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=${redirectPath}">
  <script>window.location.href = "${redirectPath}";</script>
</head>
<body></body>
</html>`;
    const outputPath = path.join(outDir, "index.html");
    await Bun.write(outputPath, redirectHtml);
    console.log(`  / → ${path.relative(process.cwd(), outputPath)} (redirect to ${redirectPath})`);
  }

  console.log(`\nDone! Built ${totalPages} pages to ${outDir}`);
}
