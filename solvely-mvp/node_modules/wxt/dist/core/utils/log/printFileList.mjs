import path from "node:path";
import pc from "picocolors";
import fs from "fs-extra";
import { filesize } from "filesize";
import { printTable } from "./printTable.mjs";
export async function printFileList(log, header, baseDir, files) {
  let totalSize = 0;
  const fileRows = await Promise.all(
    files.map(async (file, i) => {
      const parts = [
        path.relative(process.cwd(), baseDir) + path.sep,
        path.relative(baseDir, file)
      ];
      const prefix = i === files.length - 1 ? "  \u2514\u2500" : "  \u251C\u2500";
      const color = getChunkColor(file);
      const stats = await fs.lstat(file);
      totalSize += stats.size;
      const size = String(filesize(stats.size));
      return [
        `${pc.gray(prefix)} ${pc.dim(parts[0])}${color(parts[1])}`,
        pc.dim(size)
      ];
    })
  );
  fileRows.push([`${pc.cyan("\u03A3 Total size:")} ${String(filesize(totalSize))}`]);
  printTable(log, header, fileRows);
}
const DEFAULT_COLOR = pc.blue;
const CHUNK_COLORS = {
  ".js.map": pc.gray,
  ".cjs.map": pc.gray,
  ".mjs.map": pc.gray,
  ".html": pc.green,
  ".css": pc.magenta,
  ".js": pc.cyan,
  ".cjs": pc.cyan,
  ".mjs": pc.cyan,
  ".zip": pc.yellow
};
function getChunkColor(filename) {
  return Object.entries(CHUNK_COLORS).find(([key]) => filename.endsWith(key))?.[1] ?? DEFAULT_COLOR;
}
