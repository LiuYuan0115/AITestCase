export declare const virtualEntrypointTypes: ("background" | "unlisted-script" | "content-script-main-world" | "content-script-isolated-world")[];
export type VirtualEntrypointType = (typeof virtualEntrypointTypes)[0];
/**
 * All the names of entrypoint files in the `src/virtual/` and `dist/virtual/` directories, minus the extension.
 */
export declare const virtualEntrypointModuleNames: ("background-entrypoint" | "unlisted-script-entrypoint" | "content-script-main-world-entrypoint" | "content-script-isolated-world-entrypoint")[];
/**
 * Name of entrypoint files in the `src/virtual/` and `dist/virtual/` directories, minus the extension.
 */
export type VirtualEntrypointModuleName = (typeof virtualEntrypointModuleNames)[0];
/**
 * All the names of files in the `src/virtual/` and `dist/virtual/` directories, minus the extension.
 */
export declare const virtualModuleNames: ("background-entrypoint" | "unlisted-script-entrypoint" | "content-script-main-world-entrypoint" | "content-script-isolated-world-entrypoint" | "mock-browser" | "reload-html")[];
/**
 * Name of files in the `src/virtual/` and `dist/virtual/` directories, minus the extension.
 */
export type VirtualModuleName = (typeof virtualModuleNames)[0];
/**
 * Import alias used for importing a virtual module
 */
export type VirtualModuleId = `virtual:wxt-${VirtualModuleName}`;
