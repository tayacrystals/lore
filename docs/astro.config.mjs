// @ts-check
import { defineConfig } from "astro/config";
import astrodocs from "astrodocs";

export default defineConfig({
  site: "https://astrodocs.example.com",
  integrations: [
    astrodocs({
      title: "AstroDocs",
      sidebar: {
        "getting-started": { label: "Getting Started", order: 1 },
        guides: { label: "Guides", order: 2 },
        customization: { label: "Customization", order: 3 },
      },
      social: {
        github: "https://github.com",
      },
    }),
  ],
});
