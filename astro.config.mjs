// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode from "astro-expressive-code";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import pagefind from "astro-pagefind";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    expressiveCode({
      themes: ["github-dark", "github-light"],
      themeCssSelector: (theme) => {
        if (theme.name === "github-dark") return ".dark";
        return ":root:not(.dark)";
      },
      styleOverrides: {
        borderRadius: "0.5rem",
        codeFontFamily: "'Geist Mono', monospace",
        codeFontSize: "0.875rem",
      },
    }),
    mdx(),
    sitemap(),
    icon(),
    pagefind(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
