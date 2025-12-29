import { normalizePath } from "../../../utils/paths.mjs";
import {
  virtualModuleNames
} from "../../../utils/virtual-modules.mjs";
import fs from "fs-extra";
import { resolve } from "path";
export function resolveVirtualModules(config) {
  return virtualModuleNames.map((name) => {
    const virtualId = `virtual:wxt-${name}?`;
    const resolvedVirtualId = "\0" + virtualId;
    return {
      name: `wxt:resolve-virtual-${name}`,
      resolveId(id) {
        const index = id.indexOf(virtualId);
        if (index === -1) return;
        const inputPath = normalizePath(id.substring(index + virtualId.length));
        return resolvedVirtualId + inputPath;
      },
      async load(id) {
        if (!id.startsWith(resolvedVirtualId)) return;
        const inputPath = id.replace(resolvedVirtualId, "");
        const template = await fs.readFile(
          resolve(config.wxtModuleDir, `dist/virtual/${name}.mjs`),
          "utf-8"
        );
        return template.replace(`virtual:user-${name}`, inputPath);
      }
    };
  });
}
