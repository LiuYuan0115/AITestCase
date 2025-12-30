import { LogLevels, consola } from "consola";
import { printHeader } from "./log/index.mjs";
import { formatDuration } from "./time.mjs";
export function defineCommand(cb, options) {
  return async (...args) => {
    const isDebug = !!args.find((arg) => arg?.debug);
    if (isDebug) {
      consola.level = LogLevels.debug;
    }
    const startTime = Date.now();
    try {
      printHeader();
      const ongoing = await cb(...args);
      if (!ongoing && !options?.disableFinishedLog)
        consola.success(
          `Finished in ${formatDuration(Date.now() - startTime)}`
        );
    } catch (err) {
      consola.fail(
        `Command failed after ${formatDuration(Date.now() - startTime)}`
      );
      consola.error(err);
      process.exit(1);
    }
  };
}
