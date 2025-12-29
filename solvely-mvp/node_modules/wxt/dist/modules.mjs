import * as vite from "vite";
import glob from "fast-glob";
import { resolve } from "node:path";
export {};
export function defineWxtModule(module) {
  if (typeof module === "function") return { setup: module };
  return module;
}
export function addEntrypoint(wxt, entrypoint) {
  wxt.hooks.hook("entrypoints:resolved", (_, entrypoints) => {
    entrypoints.push(entrypoint);
  });
}
export function addPublicAssets(wxt, dir) {
  wxt.hooks.hook("build:publicAssets", async (wxt2, files) => {
    const moreFiles = await glob("**/*", { cwd: dir });
    if (moreFiles.length === 0) {
      wxt2.logger.warn("No files to copy in", dir);
      return;
    }
    moreFiles.forEach((file) => {
      files.unshift({ absoluteSrc: resolve(dir, file), relativeDest: file });
    });
  });
}
export function addViteConfig(wxt, viteConfig) {
  wxt.hooks.hook("config:resolved", (wxt2) => {
    const userVite = wxt2.config.vite;
    wxt2.config.vite = async (env) => {
      const fromUser = await userVite(env);
      const fromModule = viteConfig(env) ?? {};
      return vite.mergeConfig(fromModule, fromUser);
    };
  });
}
export function addWxtPlugin(wxt, plugin) {
  wxt.hooks.hook("config:resolved", (wxt2) => {
    wxt2.config.plugins.push(plugin);
  });
}
export function addImportPreset(wxt, preset) {
  wxt.hooks.hook("config:resolved", (wxt2) => {
    if (!wxt2.config.imports) return;
    wxt2.config.imports.presets ??= [];
    if (wxt2.config.imports.presets.includes(preset)) return;
    wxt2.config.imports.presets.push(preset);
  });
}
export function addAlias(wxt, alias, path) {
  wxt.hooks.hook("config:resolved", (wxt2) => {
    const target = resolve(wxt2.config.root, path);
    if (wxt2.config.alias[alias] != null && wxt2.config.alias[alias] !== target) {
      wxt2.logger.warn(
        `Skipped adding alias (${alias} => ${target}) because an alias with the same name already exists: ${alias} => ${wxt2.config.alias[alias]}`
      );
      return;
    }
    wxt2.config.alias[alias] = target;
  });
}
