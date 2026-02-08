import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import expressiveCode from "astro-expressive-code";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { validateConfig, type LoreUserConfig } from "./config";
import { vitePluginLore } from "./vite-plugin";

export function defineIntegration(userConfig: LoreUserConfig = {}): AstroIntegration {
  const config = validateConfig(userConfig);

  return {
    name: "lore",
    hooks: {
      "astro:config:setup": ({
        injectRoute,
        updateConfig,
      }) => {
        const routePath = fileURLToPath(
          new URL("./routes/docs.astro", import.meta.url),
        );

        injectRoute({
          pattern: "docs/[...slug]",
          entrypoint: routePath,
        });

        updateConfig({
          integrations: [
            expressiveCode({
              themes: ["github-dark", "github-light"],
              themeCssSelector: (theme) => {
                if (theme.name === "github-dark") return ".dark";
                return ":root:not(.dark)";
              },
              defaultProps: {
                frame: "code",
                overridesByLang: {
                  "bash,sh,shell,zsh,powershell,ps,bat,cmd,terminal": {
                    frame: "code",
                  },
                },
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
            plugins: [
              tailwindcss(),
              vitePluginLore(config),
            ],
          },
        });
      },
    },
  };
}
