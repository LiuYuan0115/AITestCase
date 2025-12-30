import { relative } from "node:path";
import { wxt } from "../wxt.mjs";
export function createSafariRunner() {
  return {
    async openBrowser() {
      wxt.logger.warn(
        `Cannot Safari using web-ext. Load "${relative(
          process.cwd(),
          wxt.config.outDir
        )}" as an unpacked extension manually`
      );
    },
    async closeBrowser() {
    }
  };
}
