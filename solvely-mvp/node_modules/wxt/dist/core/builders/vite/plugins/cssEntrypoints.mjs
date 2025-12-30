import { getEntrypointBundlePath } from "../../../utils/entrypoints.mjs";
export function cssEntrypoints(entrypoint, config) {
  return {
    name: "wxt:css-entrypoint",
    config() {
      return {
        build: {
          rollupOptions: {
            output: {
              assetFileNames: () => getEntrypointBundlePath(entrypoint, config.outDir, ".css")
            }
          }
        }
      };
    },
    generateBundle(_, bundle) {
      Object.keys(bundle).forEach((file) => {
        if (file.endsWith(".js")) delete bundle[file];
      });
    }
  };
}
