import { glob } from "astro/loaders";

export function docsLoader() {
  return glob({ pattern: "**/*.mdx", base: "./src/content/docs" });
}
