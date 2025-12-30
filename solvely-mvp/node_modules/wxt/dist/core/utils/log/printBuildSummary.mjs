import { resolve } from "path";
import { printFileList } from "./printFileList.mjs";
import { wxt } from "../../wxt.mjs";
export async function printBuildSummary(log, header, output) {
  const chunks = [
    ...output.steps.flatMap((step) => step.chunks),
    ...output.publicAssets
  ].sort((l, r) => {
    const lWeight = getChunkSortWeight(l.fileName);
    const rWeight = getChunkSortWeight(r.fileName);
    const diff = lWeight - rWeight;
    if (diff !== 0) return diff;
    return l.fileName.localeCompare(r.fileName);
  });
  const files = chunks.map(
    (chunk) => resolve(wxt.config.outDir, chunk.fileName)
  );
  await printFileList(log, header, wxt.config.outDir, files);
}
const DEFAULT_SORT_WEIGHT = 100;
const CHUNK_SORT_WEIGHTS = {
  "manifest.json": 0,
  ".html": 1,
  ".js.map": 2,
  ".js": 2,
  ".css": 3
};
function getChunkSortWeight(filename) {
  return Object.entries(CHUNK_SORT_WEIGHTS).find(
    ([key]) => filename.endsWith(key)
  )?.[1] ?? DEFAULT_SORT_WEIGHT;
}
