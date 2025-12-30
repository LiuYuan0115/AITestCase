import { browser } from "wxt/browser";
export class WxtLocationChangeEvent extends Event {
  constructor(newUrl, oldUrl) {
    super(WxtLocationChangeEvent.EVENT_NAME, {});
    this.newUrl = newUrl;
    this.oldUrl = oldUrl;
  }
  static EVENT_NAME = getUniqueEventName("wxt:locationchange");
}
export function getUniqueEventName(eventName) {
  return `${browser?.runtime?.id}:${import.meta.env.ENTRYPOINT}:${eventName}`;
}
