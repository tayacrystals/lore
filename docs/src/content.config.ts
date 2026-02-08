import { defineCollection } from "astro:content";
import { docsLoader } from "astrodocs/loaders";
import { docsSchema } from "astrodocs/schema";

const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema(),
});

export const collections = { docs };
