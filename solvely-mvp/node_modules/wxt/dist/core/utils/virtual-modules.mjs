export const virtualEntrypointTypes = [
  "content-script-main-world",
  "content-script-isolated-world",
  "background",
  "unlisted-script"
];
export const virtualEntrypointModuleNames = virtualEntrypointTypes.map(
  (name) => `${name}-entrypoint`
);
export const virtualModuleNames = [
  ...virtualEntrypointModuleNames,
  "mock-browser",
  "reload-html"
];
