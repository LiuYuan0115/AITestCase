import { findEntrypoints } from "./utils/building/index.mjs";
import { generateWxtDir } from "./generate-wxt-dir.mjs";
import { registerWxt, wxt } from "./wxt.mjs";
export async function prepare(config) {
  await registerWxt("build", config);
  wxt.logger.info("Generating types...");
  const entrypoints = await findEntrypoints();
  await generateWxtDir(entrypoints);
}
