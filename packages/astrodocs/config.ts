import { z } from "zod";

const configSchema = z.object({
  title: z.string().default("Docs"),
  sidebar: z
    .record(
      z.string(),
      z.object({
        label: z.string(),
        order: z.number(),
      }),
    )
    .optional()
    .default({}),
  social: z
    .object({
      github: z.string().optional(),
    })
    .optional()
    .default({}),
  customCss: z.array(z.string()).optional().default([]),
});

export type AstroDocsUserConfig = z.input<typeof configSchema>;
export type AstroDocsConfig = z.output<typeof configSchema>;

export function validateConfig(userConfig: AstroDocsUserConfig): AstroDocsConfig {
  return configSchema.parse(userConfig);
}
