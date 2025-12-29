import { InlineConfig } from '../types';
/**
 * Remove generated/temp files from the directory.
 *
 * @param config Optional config that will override your `<root>/wxt.config.ts`.
 *
 * @example
 * await clean();
 */
export declare function clean(config?: InlineConfig): Promise<void>;
/**
 * Remove generated/temp files from the directory.
 *
 * @deprecated
 *
 * @param root The directory to look for generated/temp files in. Defaults to `process.cwd()`. Can be relative to `process.cwd()` or absolute.
 *
 * @example
 * await clean();
 */
export declare function clean(root?: string): Promise<void>;
