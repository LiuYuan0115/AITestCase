import { Plugin } from 'vite';
/**
 * In dev mode, if there's not a background script listed, we need to add one so that the web socket
 * connection is setup and the extension reloads HTML pages and content scripts correctly.
 */
export declare function noopBackground(): Plugin;
