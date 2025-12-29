import { generateWxtDir } from "../../generate-wxt-dir.mjs";
import { buildEntrypoints } from "./build-entrypoints.mjs";
import { generateManifest, writeManifest } from "../../utils/manifest.mjs";
import { wxt } from "../../wxt.mjs";
export async function rebuild(allEntrypoints, entrypointGroups, existingOutput = {
  steps: [],
  publicAssets: []
}) {
  const { default: ora } = await import("ora");
  const spinner = ora(`Preparing...`).start();
  await generateWxtDir(allEntrypoints).catch((err) => {
    wxt.logger.warn("Failed to update .wxt directory:", err);
    if (wxt.config.command === "build") throw err;
  });
  const newOutput = await buildEntrypoints(entrypointGroups, spinner);
  const mergedOutput = {
    steps: [...existingOutput.steps, ...newOutput.steps],
    // Do not merge existing because all publicAssets copied everytime
    publicAssets: newOutput.publicAssets
  };
  const { manifest: newManifest, warnings: manifestWarnings } = await generateManifest(allEntrypoints, mergedOutput);
  const finalOutput = {
    manifest: newManifest,
    ...mergedOutput
  };
  await writeManifest(newManifest, finalOutput);
  spinner.clear().stop();
  return {
    output: finalOutput,
    manifest: newManifest,
    warnings: manifestWarnings
  };
}
