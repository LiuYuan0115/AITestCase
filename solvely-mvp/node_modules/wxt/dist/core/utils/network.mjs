import dns from "node:dns";
import { withTimeout } from "./time.mjs";
function isOffline() {
  const isOffline2 = new Promise((res) => {
    dns.resolve("google.com", (err) => {
      if (err == null) {
        res(false);
      } else {
        res(true);
      }
    });
  });
  return withTimeout(isOffline2, 1e3).catch(() => true);
}
export async function isOnline() {
  const offline = await isOffline();
  return !offline;
}
export async function fetchCached(url, config) {
  let content = "";
  if (await isOnline()) {
    const res = await fetch(url);
    if (res.status < 300) {
      content = await res.text();
      await config.fsCache.set(url, content);
    } else {
      config.logger.debug(
        `Failed to download "${url}", falling back to cache...`
      );
    }
  }
  if (!content) content = await config.fsCache.get(url) ?? "";
  if (!content)
    throw Error(
      `Offline and "${url}" has not been cached. Try again when online.`
    );
  return content;
}
