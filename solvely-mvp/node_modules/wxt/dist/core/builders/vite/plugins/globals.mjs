import { getGlobals } from "../../../utils/globals.mjs";
export function globals(config) {
  return {
    name: "wxt:globals",
    config() {
      const define = {};
      for (const global of getGlobals(config)) {
        define[`import.meta.env.${global.name}`] = JSON.stringify(global.value);
      }
      return {
        define
      };
    }
  };
}
