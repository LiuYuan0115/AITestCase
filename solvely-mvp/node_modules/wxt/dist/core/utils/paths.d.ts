/**
 * Converts system paths to normalized bundler path. On windows and unix, this returns paths with /
 * instead of \.
 */
export declare function normalizePath(path: string): string;
/**
 * Given a normalized path, convert it to the system path style. On Windows, switch to \, otherwise use /.
 */
export declare function unnormalizePath(path: string): string;
export declare const CSS_EXTENSIONS: string[];
export declare const CSS_EXTENSIONS_PATTERN: string;
