import { ResolvedConfig } from '../../../../types';
import * as vite from 'vite';
/**
 * Transforms entrypoints, removing the main function from the entrypoint if it exists.
 */
export declare function removeEntrypointMainFunction(config: ResolvedConfig, path: string): vite.Plugin;
