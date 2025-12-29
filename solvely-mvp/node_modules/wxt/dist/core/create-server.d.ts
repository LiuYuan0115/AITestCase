import { InlineConfig, WxtDevServer } from '../types';
/**
 * Creates a dev server and pre-builds all the files that need to exist before loading the extension.
 *
 * @example
 * const server = await wxt.createServer({
 *   // Enter config...
 * });
 * await server.start();
 */
export declare function createServer(inlineConfig?: InlineConfig): Promise<WxtDevServer>;
