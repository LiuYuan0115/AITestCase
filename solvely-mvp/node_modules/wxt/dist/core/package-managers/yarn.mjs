import { dedupeDependencies, npm } from "./npm.mjs";
import spawn from "nano-spawn";
export const yarn = {
  overridesKey: "resolutions",
  downloadDependency(...args) {
    return npm.downloadDependency(...args);
  },
  async listDependencies(options) {
    const args = ["list", "--json"];
    if (options?.all) {
      args.push("--depth", "Infinity");
    }
    const res = await spawn("yarn", args, { cwd: options?.cwd });
    const tree = res.stdout.split("\n").map((line) => JSON.parse(line)).find((line) => line.type === "tree")?.data;
    if (tree == null) throw Error("'yarn list --json' did not output a tree");
    const queue = [...tree.trees];
    const dependencies = [];
    while (queue.length > 0) {
      const { name: treeName, children } = queue.pop();
      const match = /(@?\S+)@(\S+)$/.exec(treeName);
      if (match) {
        const [_, name, version] = match;
        dependencies.push({ name, version });
      }
      if (children != null) {
        queue.push(...children);
      }
    }
    return dedupeDependencies(dependencies);
  }
};
