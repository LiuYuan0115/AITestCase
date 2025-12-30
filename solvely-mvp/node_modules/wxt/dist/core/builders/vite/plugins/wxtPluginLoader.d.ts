import type * as vite from 'vite';
import { ResolvedConfig } from '../../../../types';
/**
 * Resolve and load plugins for each entrypoint. This handles both JS entrypoints via the `virtual:wxt-plugins` import, and HTML files by adding `virtual:wxt-html-plugins` to the document's `<head>`
 */
export declare function wxtPluginLoader(config: ResolvedConfig): vite.Plugin;
