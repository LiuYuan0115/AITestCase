import { parseHTML } from "linkedom";
import { createEnvironment } from "./environment.mjs";
export function createBrowserEnvironment() {
  return createEnvironment(getBrowserEnvironmentGlobals);
}
export function getBrowserEnvironmentGlobals() {
  const { window, document, global } = parseHTML(`
    <html>
      <head></head>
      <body></body>
    </html>
  `);
  return {
    ...global,
    window,
    document,
    self: global
  };
}
