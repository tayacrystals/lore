import { z } from "zod";

export function docsSchema() {
  return z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(999),
    group: z.string().optional(),
    icon: z.string().optional(),
    toc: z.boolean().default(true),
    draft: z.boolean().default(false),
  });
}
