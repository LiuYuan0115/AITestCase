import { fetchCached } from "../../../utils/network.mjs";
export function download(config) {
  return {
    name: "wxt:download",
    resolveId(id) {
      if (id.startsWith("url:")) return "\0" + id;
    },
    async load(id) {
      if (!id.startsWith("\0url:")) return;
      const url = id.replace("\0url:", "");
      return await fetchCached(url, config);
    }
  };
}
