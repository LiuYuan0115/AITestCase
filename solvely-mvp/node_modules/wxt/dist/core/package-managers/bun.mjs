import { dedupeDependencies, npm } from "./npm.mjs";
import spawn from "nano-spawn";
export const bun = {
  overridesKey: "overrides",
  // But also supports "resolutions"
  downloadDependency(...args) {
    return npm.downloadDependency(...args);
  },
  async listDependencies(options) {
    const args = ["pm", "ls"];
    if (options?.all) {
      args.push("--all");
    }
    const res = await spawn("bun", args, { cwd: options?.cwd });
    return dedupeDependencies(
      res.stdout.split("\n").slice(1).map((line) => line.trim()).map((line) => /.* (@?\S+)@(\S+)$/.exec(line)).filter((match) => !!match).map(([_, name, version]) => ({ name, version }))
    );
  }
};
