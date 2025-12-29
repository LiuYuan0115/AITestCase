import { WxtLocationChangeEvent } from "./custom-events.mjs";
export function createLocationWatcher(ctx) {
  let interval;
  let oldUrl;
  return {
    /**
     * Ensure the location watcher is actively looking for URL changes. If it's already watching,
     * this is a noop.
     */
    run() {
      if (interval != null) return;
      oldUrl = new URL(location.href);
      interval = ctx.setInterval(() => {
        let newUrl = new URL(location.href);
        if (newUrl.href !== oldUrl.href) {
          window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
          oldUrl = newUrl;
        }
      }, 1e3);
    }
  };
}
