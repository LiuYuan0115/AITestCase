import { every, some } from "../../utils/arrays.mjs";
import { normalizePath } from "../../utils/paths.mjs";
import { wxt } from "../../wxt.mjs";
export function detectDevChanges(changedFiles, currentOutput) {
  const isConfigChange = some(
    changedFiles,
    (file) => file === wxt.config.userConfigMetadata.configFile
  );
  if (isConfigChange) return { type: "full-restart" };
  const isWxtModuleChange = some(
    changedFiles,
    (file) => file.startsWith(wxt.config.modulesDir)
  );
  if (isWxtModuleChange) return { type: "full-restart" };
  const isRunnerChange = some(
    changedFiles,
    (file) => file === wxt.config.runnerConfig.configFile
  );
  if (isRunnerChange) return { type: "browser-restart" };
  const changedSteps = new Set(
    changedFiles.flatMap(
      (changedFile) => findEffectedSteps(changedFile, currentOutput)
    )
  );
  if (changedSteps.size === 0) {
    const hasPublicChange = some(
      changedFiles,
      (file) => file.startsWith(wxt.config.publicDir)
    );
    if (hasPublicChange) {
      return {
        type: "extension-reload",
        rebuildGroups: [],
        cachedOutput: currentOutput
      };
    } else {
      return { type: "no-change" };
    }
  }
  const unchangedOutput = {
    manifest: currentOutput.manifest,
    steps: [],
    publicAssets: [...currentOutput.publicAssets]
  };
  const changedOutput = {
    manifest: currentOutput.manifest,
    steps: [],
    publicAssets: []
  };
  for (const step of currentOutput.steps) {
    if (changedSteps.has(step)) {
      changedOutput.steps.push(step);
    } else {
      unchangedOutput.steps.push(step);
    }
  }
  const isOnlyHtmlChanges = changedFiles.length > 0 && every(changedFiles, (file) => file.endsWith(".html"));
  if (isOnlyHtmlChanges) {
    return {
      type: "html-reload",
      cachedOutput: unchangedOutput,
      rebuildGroups: changedOutput.steps.map((step) => step.entrypoints)
    };
  }
  const isOnlyContentScripts = changedOutput.steps.length > 0 && every(
    changedOutput.steps.flatMap((step) => step.entrypoints),
    (entry) => entry.type === "content-script"
  );
  if (isOnlyContentScripts) {
    return {
      type: "content-script-reload",
      cachedOutput: unchangedOutput,
      changedSteps: changedOutput.steps,
      rebuildGroups: changedOutput.steps.map((step) => step.entrypoints)
    };
  }
  return {
    type: "extension-reload",
    cachedOutput: unchangedOutput,
    rebuildGroups: changedOutput.steps.map((step) => step.entrypoints)
  };
}
function findEffectedSteps(changedFile, currentOutput) {
  const changes = [];
  const changedPath = normalizePath(changedFile);
  const isChunkEffected = (chunk) => {
    switch (chunk.type) {
      // If it's an HTML file with the same path, is is effected because HTML files need to be re-rendered
      // - fileName is normalized, relative bundle path, "<entrypoint-name>.html"
      case "asset": {
        return changedPath.replace("/index.html", ".html").endsWith(chunk.fileName);
      }
      // If it's a chunk that depends on the changed file, it is effected
      // - moduleIds are absolute, normalized paths
      case "chunk": {
        const modulePaths = chunk.moduleIds.map((path) => path.split("?")[0]);
        return modulePaths.includes(changedPath);
      }
      default: {
        return false;
      }
    }
  };
  for (const step of currentOutput.steps) {
    const effectedChunk = step.chunks.find((chunk) => isChunkEffected(chunk));
    if (effectedChunk) changes.push(step);
  }
  return changes;
}
