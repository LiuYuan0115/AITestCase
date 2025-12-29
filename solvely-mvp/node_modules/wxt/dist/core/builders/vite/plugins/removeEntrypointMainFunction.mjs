import { normalizePath } from "../../../utils/paths.mjs";
import { removeMainFunctionCode } from "../../../utils/transform.mjs";
import { resolve } from "node:path";
export function removeEntrypointMainFunction(config, path) {
  const absPath = normalizePath(resolve(config.root, path));
  return {
    name: "wxt:remove-entrypoint-main-function",
    transform: {
      order: "pre",
      handler(code, id) {
        if (id === absPath) {
          const newCode = removeMainFunctionCode(code);
          config.logger.debug("vite-node transformed entrypoint", path);
          config.logger.debug(`Original:
---
${code}
---`);
          config.logger.debug(`Transformed:
---
${newCode.code}
---`);
          return newCode;
        }
      }
    }
  };
}
