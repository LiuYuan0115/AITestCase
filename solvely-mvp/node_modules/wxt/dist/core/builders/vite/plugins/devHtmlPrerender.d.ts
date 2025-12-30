import type * as vite from 'vite';
import { ResolvedConfig, WxtDevServer } from '../../../../types';
/**
 * Pre-renders the HTML entrypoints when building the extension to connect to the dev server.
 */
export declare function devHtmlPrerender(config: ResolvedConfig, server: WxtDevServer | undefined): vite.PluginOption;
export declare function pointToDevServer(config: ResolvedConfig, server: WxtDevServer, id: string, document: Document, querySelector: string, attr: string): void;
