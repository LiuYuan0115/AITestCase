import { relative } from "node:path";
import { wxt } from "../wxt.mjs";
export function createWslRunner() {
  return {
    async openBrowser() {
      wxt.logger.warn(
        `Cannot open browser when using WSL. Load "${relative(
          process.cwd(),
          wxt.config.outDir
        )}" as an unpacked extension manually`
      );
    },
    async closeBrowser() {
    }
  };
}
