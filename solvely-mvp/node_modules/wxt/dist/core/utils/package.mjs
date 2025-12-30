import { resolve } from "node:path";
import fs from "fs-extra";
import { wxt } from "../wxt.mjs";
export async function getPackageJson() {
  const file = resolve(wxt.config.root, "package.json");
  try {
    return await fs.readJson(file);
  } catch (err) {
    wxt.logger.debug(
      `Failed to read package.json at: ${file}. Returning undefined.`,
      err
    );
    return {};
  }
}
