import { fakeBrowser } from "@webext-core/fake-browser";
import { getBrowserEnvironmentGlobals } from "./browser-environment.mjs";
import { createEnvironment } from "./environment.mjs";
export function createExtensionEnvironment() {
  return createEnvironment(getExtensionEnvironmentGlobals);
}
export function getExtensionEnvironmentGlobals() {
  return {
    ...getBrowserEnvironmentGlobals(),
    chrome: fakeBrowser,
    browser: fakeBrowser
  };
}
