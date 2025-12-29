import { BuildOutput, InlineConfig } from '../types';
/**
 * Bundles the extension for production. Returns a promise of the build result. Discovers the `wxt.config.ts` file in
 * the root directory, and merges that config with what is passed in.
 *
 * @example
 * // Use config from `wxt.config.ts`
 * const res = await build()
 *
 * // or override config `from wxt.config.ts`
 * const res = await build({
 *   // Override config...
 * })
 */
export declare function build(config?: InlineConfig): Promise<BuildOutput>;
