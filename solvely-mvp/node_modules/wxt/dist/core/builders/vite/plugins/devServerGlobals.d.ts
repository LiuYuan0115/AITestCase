import { Plugin } from 'vite';
import { ResolvedConfig, WxtDevServer } from '../../../../types';
/**
 * Defines global constants about the dev server. Helps scripts connect to the server's web socket.
 */
export declare function devServerGlobals(config: ResolvedConfig, server: WxtDevServer | undefined): Plugin;
