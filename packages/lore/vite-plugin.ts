import type { Plugin } from "vite";
import type { AstroDocsConfig } from "./config";

const VIRTUAL_CONFIG = "virtual:astrodocs/config";
const VIRTUAL_USER_CSS = "virtual:astrodocs/user-css";
const RESOLVED_CONFIG = "\0" + VIRTUAL_CONFIG;
const RESOLVED_USER_CSS = "\0" + VIRTUAL_USER_CSS;

export function vitePluginAstroDocs(config: AstroDocsConfig): Plugin {
  return {
    name: "astrodocs:virtual-modules",
    resolveId(id) {
      if (id === VIRTUAL_CONFIG) return RESOLVED_CONFIG;
      if (id === VIRTUAL_USER_CSS) return RESOLVED_USER_CSS;
    },
    load(id) {
      if (id === RESOLVED_CONFIG) {
        return `export default ${JSON.stringify(config)};`;
      }
      if (id === RESOLVED_USER_CSS) {
        const imports = config.customCss
          .map((css) => `import "${css}";`)
          .join("\n");
        return imports || "// No custom CSS";
      }
    },
  };
}
