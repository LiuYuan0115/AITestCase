import path from "node:path";
import { ensureDir } from "fs-extra";
import spawn from "nano-spawn";
export const npm = {
  overridesKey: "overrides",
  async downloadDependency(id, downloadDir) {
    await ensureDir(downloadDir);
    const res = await spawn("npm", ["pack", id, "--json"], {
      cwd: downloadDir
    });
    const packed = JSON.parse(res.stdout);
    return path.resolve(downloadDir, packed[0].filename);
  },
  async listDependencies(options) {
    const args = ["ls", "--json"];
    if (options?.all) {
      args.push("--depth", "Infinity");
    }
    const res = await spawn("npm", args, { cwd: options?.cwd });
    const project = JSON.parse(res.stdout);
    return flattenNpmListOutput([project]);
  }
};
export function flattenNpmListOutput(projects) {
  const queue = projects.flatMap(
    (project) => {
      const acc = [];
      if (project.dependencies) acc.push(project.dependencies);
      if (project.devDependencies) acc.push(project.devDependencies);
      return acc;
    }
  );
  const dependencies = [];
  while (queue.length > 0) {
    Object.entries(queue.pop()).forEach(([name, meta]) => {
      dependencies.push({
        name,
        version: meta.version
      });
      if (meta.dependencies) queue.push(meta.dependencies);
      if (meta.devDependencies) queue.push(meta.devDependencies);
    });
  }
  return dedupeDependencies(dependencies);
}
export function dedupeDependencies(dependencies) {
  const hashes = /* @__PURE__ */ new Set();
  return dependencies.filter((dep) => {
    const hash = `${dep.name}@${dep.version}`;
    if (hashes.has(hash)) {
      return false;
    } else {
      hashes.add(hash);
      return true;
    }
  });
}
