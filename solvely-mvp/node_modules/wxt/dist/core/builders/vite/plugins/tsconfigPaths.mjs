export function tsconfigPaths(config) {
  return {
    name: "wxt:aliases",
    async config() {
      return {
        resolve: {
          alias: config.alias
        }
      };
    }
  };
}
