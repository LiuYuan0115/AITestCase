import consola, { LogLevels } from "consola";
import { filterTruthy, toArray } from "../core/utils/arrays.mjs";
import { printHeader } from "../core/utils/log/index.mjs";
import { formatDuration } from "../core/utils/time.mjs";
import { ValidationError } from "../core/utils/validation.mjs";
import { registerWxt } from "../core/wxt.mjs";
import spawn from "nano-spawn";
export function wrapAction(cb, options) {
  return async (...args) => {
    const isDebug = !!args.find((arg) => arg?.debug);
    if (isDebug) {
      consola.level = LogLevels.debug;
    }
    const startTime = Date.now();
    try {
      printHeader();
      const status = await cb(...args);
      if (!status?.isOngoing && !options?.disableFinishedLog)
        consola.success(
          `Finished in ${formatDuration(Date.now() - startTime)}`
        );
    } catch (err) {
      consola.fail(
        `Command failed after ${formatDuration(Date.now() - startTime)}`
      );
      if (err instanceof ValidationError) {
      } else {
        consola.error(err);
      }
      process.exit(1);
    }
  };
}
export function getArrayFromFlags(flags, name) {
  const array = toArray(flags[name]);
  const result = filterTruthy(array);
  return result.length ? result : void 0;
}
const aliasCommandNames = /* @__PURE__ */ new Set();
export function createAliasedCommand(base, name, alias, bin, docsUrl) {
  const aliasedCommand = base.command(name, `Alias for ${alias} (${docsUrl})`).allowUnknownOptions().action(async () => {
    try {
      await registerWxt("build");
      const args = process.argv.slice(
        process.argv.indexOf(aliasedCommand.name) + 1
      );
      await spawn(bin, args, {
        stdio: "inherit"
      });
    } catch {
      process.exit(1);
    }
  });
  aliasCommandNames.add(aliasedCommand.name);
}
export function isAliasedCommand(command) {
  return !!command && aliasCommandNames.has(command.name);
}
