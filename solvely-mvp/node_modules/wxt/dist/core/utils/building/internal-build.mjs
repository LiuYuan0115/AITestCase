import { findEntrypoints } from "./find-entrypoints.mjs";
import pc from "picocolors";
import fs from "fs-extra";
import { groupEntrypoints } from "./group-entrypoints.mjs";
import { formatDuration } from "../../utils/time.mjs";
import { printBuildSummary } from "../../utils/log/index.mjs";
import glob from "fast-glob";
import { unnormalizePath } from "../../utils/paths.mjs";
import { rebuild } from "./rebuild.mjs";
import { relative } from "node:path";
import {
  ValidationError,
  validateEntrypoints
} from "../validation.mjs";
import { wxt } from "../../wxt.mjs";
import { mergeJsonOutputs } from "@aklinker1/rollup-plugin-visualizer";
import { isCI } from "ci-info";
export async function internalBuild() {
  await wxt.hooks.callHook("build:before", wxt);
  const verb = wxt.config.command === "serve" ? "Pre-rendering" : "Building";
  const target = `${wxt.config.browser}-mv${wxt.config.manifestVersion}`;
  wxt.logger.info(
    `${verb} ${pc.cyan(target)} for ${pc.cyan(wxt.config.mode)} with ${pc.green(
      `${wxt.builder.name} ${wxt.builder.version}`
    )}`
  );
  const startTime = Date.now();
  await fs.rm(wxt.config.outDir, { recursive: true, force: true });
  await fs.ensureDir(wxt.config.outDir);
  const entrypoints = await findEntrypoints();
  wxt.logger.debug("Detected entrypoints:", entrypoints);
  const validationResults = validateEntrypoints(entrypoints);
  if (validationResults.errorCount + validationResults.warningCount > 0) {
    printValidationResults(validationResults);
  }
  if (validationResults.errorCount > 0) {
    throw new ValidationError(`Entrypoint validation failed`, {
      cause: validationResults
    });
  }
  const groups = groupEntrypoints(entrypoints);
  await wxt.hooks.callHook("entrypoints:grouped", wxt, groups);
  const { output, warnings } = await rebuild(entrypoints, groups, void 0);
  await wxt.hooks.callHook("build:done", wxt, output);
  await printBuildSummary(
    wxt.logger.success,
    `Built extension in ${formatDuration(Date.now() - startTime)}`,
    output
  );
  for (const warning of warnings) {
    wxt.logger.warn(...warning);
  }
  if (wxt.config.analysis.enabled) {
    await combineAnalysisStats();
    const statsPath = relative(wxt.config.root, wxt.config.analysis.outputFile);
    wxt.logger.info(
      `Analysis complete:
  ${pc.gray("\u2514\u2500")} ${pc.yellow(statsPath)}`
    );
    if (wxt.config.analysis.open) {
      if (isCI) {
        wxt.logger.debug(`Skipped opening ${pc.yellow(statsPath)} in CI`);
      } else {
        wxt.logger.info(`Opening ${pc.yellow(statsPath)} in browser...`);
        const { default: open } = await import("open");
        open(wxt.config.analysis.outputFile);
      }
    }
  }
  return output;
}
async function combineAnalysisStats() {
  const unixFiles = await glob(`${wxt.config.analysis.outputName}-*.json`, {
    cwd: wxt.config.analysis.outputDir,
    absolute: true
  });
  const absolutePaths = unixFiles.map(unnormalizePath);
  await mergeJsonOutputs({
    inputs: absolutePaths,
    template: wxt.config.analysis.template,
    filename: wxt.config.analysis.outputFile
  });
  if (!wxt.config.analysis.keepArtifacts) {
    await Promise.all(absolutePaths.map((statsFile) => fs.remove(statsFile)));
  }
}
function printValidationResults({
  errorCount,
  errors,
  warningCount
}) {
  (errorCount > 0 ? wxt.logger.error : wxt.logger.warn)(
    `Entrypoint validation failed: ${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`
  );
  const cwd = process.cwd();
  const entrypointErrors = errors.reduce((map, error) => {
    const entryErrors = map.get(error.entrypoint) ?? [];
    entryErrors.push(error);
    map.set(error.entrypoint, entryErrors);
    return map;
  }, /* @__PURE__ */ new Map());
  Array.from(entrypointErrors.entries()).forEach(([entrypoint, errors2]) => {
    wxt.logger.log(relative(cwd, entrypoint.inputPath));
    console.log();
    errors2.forEach((err) => {
      const type = err.type === "error" ? pc.red("ERROR") : pc.yellow("WARN");
      const recieved = pc.dim(`(recieved: ${JSON.stringify(err.value)})`);
      wxt.logger.log(`  - ${type} ${err.message} ${recieved}`);
    });
    console.log();
  });
}
