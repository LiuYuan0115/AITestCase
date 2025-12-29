import { exists } from "fs-extra";
import { resolve } from "node:path";
export function resolveAppConfig(config) {
  const virtualModuleId = "virtual:app-config";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;
  const appConfigFile = resolve(config.srcDir, "app.config.ts");
  return {
    name: "wxt:resolve-app-config",
    config() {
      return {
        optimizeDeps: {
          // Prevent ESBuild from attempting to resolve the virtual module
          // while optimizing WXT.
          exclude: [virtualModuleId]
        }
      };
    },
    async resolveId(id) {
      if (id !== virtualModuleId) return;
      return await exists(appConfigFile) ? appConfigFile : resolvedVirtualModuleId;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) return `export default {}`;
    }
  };
}
