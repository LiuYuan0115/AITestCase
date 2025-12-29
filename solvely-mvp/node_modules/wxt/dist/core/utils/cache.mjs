import fs, { ensureDir } from "fs-extra";
import { dirname, resolve } from "path";
import { writeFileIfDifferent } from "./fs.mjs";
export function createFsCache(wxtDir) {
  const getPath = (key) => resolve(wxtDir, "cache", encodeURIComponent(key));
  return {
    async set(key, value) {
      const path = getPath(key);
      await ensureDir(dirname(path));
      await writeFileIfDifferent(path, value);
    },
    async get(key) {
      const path = getPath(key);
      try {
        return await fs.readFile(path, "utf-8");
      } catch {
        return void 0;
      }
    }
  };
}
