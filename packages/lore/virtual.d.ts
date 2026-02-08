declare module "virtual:lore/config" {
  import type { LoreConfig } from "lore/config";
  const config: LoreConfig;
  export default config;
}

declare module "virtual:lore/user-css" {
  // Side-effect imports only
}
