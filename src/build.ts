import { mkdir } from "node:fs/promises";
import path from "node:path";
import { renderMdx } from "./mdx.ts";
import { loadConfig } from "./config.ts";
import { buildDocTree } from "./files.ts";
import { renderPage } from "./template.ts";

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

  const config = await loadConfig(docsDir);
  const { pages, sidebar } = await buildDocTree(docsDir);
  const logoSrc = await findLogo(docsDir, outDir);

  console.log(`Found ${pages.length} pages`);

  for (const page of pages) {
    const contentHtml = await renderMdx(page.content);

    const html = renderPage({
      config,
      title: page.title,
      description: page.description,
      contentHtml,
      sidebar,
      currentUrl: page.url,
      logoSrc,
      devMode: opts.devMode,
    });

    // Determine output path
    const outputPath =
      page.url === "/"
        ? path.join(outDir, "index.html")
        : path.join(outDir, page.url.slice(1), "index.html");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await Bun.write(outputPath, html);
    console.log(`  ${page.url} → ${path.relative(process.cwd(), outputPath)}`);
  }

  console.log(`\nDone! Built ${pages.length} pages to ${outDir}`);
}
