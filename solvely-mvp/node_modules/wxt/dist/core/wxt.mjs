import { resolveConfig } from "./resolve-config.mjs";
import { createHooks } from "hookable";
import { createWxtPackageManager } from "./package-managers/index.mjs";
import { createViteBuilder } from "./builders/vite/index.mjs";
import { builtinModules } from "../builtin-modules/index.mjs";
import { relative } from "path";
export let wxt;
export async function registerWxt(command, inlineConfig = {}) {
  process.env.NODE_ENV ??= inlineConfig.mode ?? (command === "serve" ? "development" : "production");
  const hooks = createHooks();
  const config = await resolveConfig(inlineConfig, command);
  const builder = await createViteBuilder(config, hooks, () => wxt.server);
  const pm = await createWxtPackageManager(config.root);
  wxt = {
    config,
    hooks,
    hook: hooks.hook.bind(hooks),
    get logger() {
      return config.logger;
    },
    async reloadConfig() {
      if (wxt.config.dev.server?.port) {
        inlineConfig.dev ??= {};
        inlineConfig.dev.server ??= {};
        inlineConfig.dev.server.port = wxt.config.dev.server.port;
      }
      wxt.config = await resolveConfig(inlineConfig, command);
      await wxt.hooks.callHook("config:resolved", wxt);
    },
    pm,
    builder,
    server: void 0
  };
  await initWxtModules();
}
export async function initWxtModules() {
  for (const mod of builtinModules) await initWxtModule(mod);
  for (const mod of wxt.config.userModules) await initWxtModule(mod);
  wxt.hooks.addHooks(wxt.config.hooks);
  if (wxt.config.debug) {
    const order = [
      ...builtinModules.map((module) => module.name),
      ...wxt.config.userModules.map(
        (module) => relative(wxt.config.root, module.id)
      ),
      "wxt.config.ts > hooks"
    ];
    wxt.logger.debug("Hook execution order:");
    order.forEach((name, i) => {
      wxt.logger.debug(`  ${i + 1}. ${name}`);
    });
  }
  await wxt.hooks.callHook("ready", wxt);
  await wxt.hooks.callHook("config:resolved", wxt);
}
async function initWxtModule(module) {
  if (module.hooks) wxt.hooks.addHooks(module.hooks);
  await module.setup?.(
    wxt,
    // @ts-expect-error: Untyped configKey field
    module.configKey ? wxt.config[module.configKey] : void 0
  );
}
export function deinitWxtModules() {
  wxt.hooks.removeAllHooks();
}
export function setWxtForTesting(testInstance) {
  wxt = testInstance;
}
