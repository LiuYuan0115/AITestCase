import path, { relative, resolve, extname } from "node:path";
import { normalizePath } from "./paths.mjs";
export function getEntrypointName(entrypointsDir, inputPath) {
  const relativePath = path.relative(entrypointsDir, inputPath);
  const name = relativePath.split(/[./\\]/, 2)[0];
  return name;
}
export function getEntrypointOutputFile(entrypoint, ext) {
  return resolve(entrypoint.outputDir, `${entrypoint.name}${ext}`);
}
export function getEntrypointBundlePath(entrypoint, outDir, ext) {
  return normalizePath(
    relative(outDir, getEntrypointOutputFile(entrypoint, ext))
  );
}
export function resolvePerBrowserOption(option, browser) {
  if (typeof option === "object" && !Array.isArray(option))
    return option[browser];
  return option;
}
export function resolvePerBrowserOptions(options, browser) {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      key === "defaultIcon" ? value : resolvePerBrowserOption(value, browser)
    ])
  );
}
export function isHtmlEntrypoint(entrypoint) {
  const ext = extname(entrypoint.inputPath);
  return [".html"].includes(ext);
}
export function isJsEntrypoint(entrypoint) {
  const ext = extname(entrypoint.inputPath);
  return [".js", ".jsx", ".ts", ".tsx"].includes(ext);
}
