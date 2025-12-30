import fs from "fs-extra";
import glob from "fast-glob";
import { unnormalizePath } from "./paths.mjs";
import { wxt } from "../wxt.mjs";
export async function writeFileIfDifferent(file, newContents) {
  const existingContents = await fs.readFile(file, "utf-8").catch(() => void 0);
  if (existingContents !== newContents) {
    await fs.writeFile(file, newContents);
  }
}
export async function getPublicFiles() {
  if (!await fs.exists(wxt.config.publicDir)) return [];
  const files = await glob("**/*", { cwd: wxt.config.publicDir });
  return files.map(unnormalizePath);
}
