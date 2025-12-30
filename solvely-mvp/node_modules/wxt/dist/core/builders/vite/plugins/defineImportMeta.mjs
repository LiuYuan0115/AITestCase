export function defineImportMeta() {
  return {
    name: "wxt:define",
    config() {
      return {
        define: {
          // This works for all extension contexts, including background service worker
          "import.meta.url": "self.location.href"
        }
      };
    }
  };
}
