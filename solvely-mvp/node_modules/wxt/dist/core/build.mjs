import { internalBuild } from "./utils/building/index.mjs";
import { registerWxt } from "./wxt.mjs";
export async function build(config) {
  await registerWxt("build", config);
  return await internalBuild();
}
