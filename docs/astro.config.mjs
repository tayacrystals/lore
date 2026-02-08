// @ts-check
import { defineConfig } from "astro/config";
import lore from "lore";

export default defineConfig({
  site: "https://lore.example.com",
  integrations: [
    lore({
      title: "Lore",
      sidebar: {
        "getting-started": { label: "Getting Started", order: 1 },
        guides: { label: "Guides", order: 2 },
        components: { label: "Components", order: 3 },
        customization: { label: "Customization", order: 4 },
      },
      social: {
        github: "https://github.com/tayacrystals/lore",
      },
    }),
  ],
});
