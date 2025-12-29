import { Plugin } from 'vite';
import { ResolvedConfig } from '../../../../types';
/**
 * Resolve all the virtual modules to the `node_modules/wxt/dist/virtual` directory.
 */
export declare function resolveVirtualModules(config: ResolvedConfig): Plugin[];
