import systemPath from "node:path";
import normalize from "normalize-path";
export function normalizePath(path) {
  return normalize(path);
}
export function unnormalizePath(path) {
  return systemPath.normalize(path);
}
export const CSS_EXTENSIONS = ["css", "scss", "sass", "less", "styl", "stylus"];
export const CSS_EXTENSIONS_PATTERN = `+(${CSS_EXTENSIONS.join("|")})`;
