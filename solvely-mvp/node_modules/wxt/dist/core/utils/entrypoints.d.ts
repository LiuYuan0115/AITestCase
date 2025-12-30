import { Entrypoint, PerBrowserOption, ResolvedPerBrowserOptions, TargetBrowser } from '../../types';
export declare function getEntrypointName(entrypointsDir: string, inputPath: string): string;
export declare function getEntrypointOutputFile(entrypoint: Entrypoint, ext: string): string;
/**
 * Return's the entrypoint's output path relative to the output directory. Used for paths in the
 * manifest and rollup's bundle.
 */
export declare function getEntrypointBundlePath(entrypoint: Entrypoint, outDir: string, ext: string): string;
/**
 * Given an entrypoint option, resolve it's value based on a target browser.
 */
export declare function resolvePerBrowserOption<T>(option: PerBrowserOption<T>, browser: TargetBrowser): T;
/**
 * Given an entrypoint option, resolve it's value based on a target browser.
 *
 * defaultIcon is special, it's the only key that's a record, which can confuse this function. So
 * it's been manually excluded from resolution.
 */
export declare function resolvePerBrowserOptions<T extends Record<string, any>, TKeys extends keyof T>(options: T, browser: TargetBrowser): ResolvedPerBrowserOptions<T, TKeys>;
/**
 * Returns true when the entrypoint is an HTML entrypoint.
 *
 * Naively just checking the file extension of the input path.
 */
export declare function isHtmlEntrypoint(entrypoint: Pick<Entrypoint, 'inputPath'>): boolean;
/**
 * Returns true when the entrypoint is a JS entrypoint.
 *
 * Naively just checking the file extension of the input path.
 */
export declare function isJsEntrypoint(entrypoint: Pick<Entrypoint, 'inputPath'>): boolean;
