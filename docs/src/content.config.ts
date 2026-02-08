import { defineCollection } from "astro:content";
import { docsLoader } from "lore/loaders";
import { docsSchema } from "lore/schema";

const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema(),
});

export const collections = { docs };
