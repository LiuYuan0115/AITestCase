import { relative } from "node:path";
import { wxt } from "../wxt.mjs";
export function createManualRunner() {
  return {
    async openBrowser() {
      wxt.logger.info(
        `Load "${relative(
          process.cwd(),
          wxt.config.outDir
        )}" as an unpacked extension manually`
      );
    },
    async closeBrowser() {
    }
  };
}
