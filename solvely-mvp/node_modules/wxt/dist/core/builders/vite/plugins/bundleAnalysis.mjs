import { visualizer } from "@aklinker1/rollup-plugin-visualizer";
import path from "node:path";
let increment = 0;
export function bundleAnalysis(config) {
  return visualizer({
    template: "raw-data",
    filename: path.resolve(
      config.analysis.outputDir,
      `${config.analysis.outputName}-${increment++}.json`
    )
  });
}
export function resetBundleIncrement() {
  increment = 0;
}
