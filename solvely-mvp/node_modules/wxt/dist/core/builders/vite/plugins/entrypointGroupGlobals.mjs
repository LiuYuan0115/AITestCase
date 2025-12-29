import { getEntrypointGlobals } from "../../../utils/globals.mjs";
export function entrypointGroupGlobals(entrypointGroup) {
  return {
    name: "wxt:entrypoint-group-globals",
    config() {
      const define = {};
      let name = Array.isArray(entrypointGroup) ? "html" : entrypointGroup.name;
      for (const global of getEntrypointGlobals(name)) {
        define[`import.meta.env.${global.name}`] = JSON.stringify(global.value);
      }
      return {
        define
      };
    }
  };
}
