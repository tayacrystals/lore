import { z } from "zod";

const sidebarGroupSchema: z.ZodType<{
  label: string;
  order: number;
  children?: Record<string, { label: string; order: number; children?: Record<string, any> }>;
}> = z.lazy(() =>
  z.object({
    label: z.string(),
    order: z.number(),
    children: z.record(z.string(), sidebarGroupSchema).optional().default({}),
  }),
);

const configSchema = z.object({
  title: z.string().default("Docs"),
  sidebar: z
    .record(z.string(), sidebarGroupSchema)
    .optional()
    .default({}),
  social: z
    .object({
      github: z.string().optional(),
    })
    .optional()
    .default({}),
  primaryHue: z.number().min(0).max(360).optional().default(55),
  customCss: z.array(z.string()).optional().default([]),
});

export type AstroDocsUserConfig = z.input<typeof configSchema>;
export type AstroDocsConfig = z.output<typeof configSchema>;

export interface SidebarGroupConfig {
  label: string;
  order: number;
  children?: Record<string, SidebarGroupConfig>;
}

export function validateConfig(userConfig: AstroDocsUserConfig): AstroDocsConfig {
  return configSchema.parse(userConfig);
}
