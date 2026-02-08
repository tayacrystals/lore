import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(999),
    group: z.string().optional(),
    icon: z.string().optional(),
    toc: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs };
