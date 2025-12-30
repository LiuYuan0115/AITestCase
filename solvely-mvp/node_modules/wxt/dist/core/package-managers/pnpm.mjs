import { flattenNpmListOutput, npm } from "./npm.mjs";
import spawn from "nano-spawn";
export const pnpm = {
  overridesKey: "resolutions",
  // "pnpm.overrides" has a higher priority, but I don't want to deal with nesting
  downloadDependency(...args) {
    return npm.downloadDependency(...args);
  },
  async listDependencies(options) {
    const args = ["ls", "-r", "--json"];
    if (options?.all) {
      args.push("--depth", "Infinity");
    }
    if (typeof process !== "undefined" && process.env.WXT_PNPM_IGNORE_WORKSPACE === "true") {
      args.push("--ignore-workspace");
    }
    const res = await spawn("pnpm", args, { cwd: options?.cwd });
    const projects = JSON.parse(res.stdout);
    return flattenNpmListOutput(projects);
  }
};
