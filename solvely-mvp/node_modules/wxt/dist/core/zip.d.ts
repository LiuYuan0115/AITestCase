import { InlineConfig } from '../types';
/**
 * Build and zip the extension for distribution.
 * @param config Optional config that will override your `<root>/wxt.config.ts`.
 * @returns A list of all files included in the ZIP.
 */
export declare function zip(config?: InlineConfig): Promise<string[]>;
