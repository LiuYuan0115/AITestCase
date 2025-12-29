import { createWslRunner } from "./wsl.mjs";
import { createWebExtRunner } from "./web-ext.mjs";
import { createSafariRunner } from "./safari.mjs";
import { createManualRunner } from "./manual.mjs";
import { isWsl } from "../utils/wsl.mjs";
import { wxt } from "../wxt.mjs";
export async function createExtensionRunner() {
  if (wxt.config.browser === "safari") return createSafariRunner();
  if (await isWsl()) return createWslRunner();
  if (wxt.config.runnerConfig.config?.disabled) return createManualRunner();
  return createWebExtRunner();
}
