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
        components: { label: "Components", order: 3 },
        customization: { label: "Customization", order: 4 },
      },
      social: {
        github: "https://github.com",
      },
    }),
  ],
});
