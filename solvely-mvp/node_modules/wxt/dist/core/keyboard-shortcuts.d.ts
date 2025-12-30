import { WxtDevServer } from '../types';
export interface KeyboardShortcutWatcher {
    start(): void;
    stop(): void;
    printHelp(flags: {
        canReopenBrowser: boolean;
    }): void;
}
/**
 * Function that creates a keyboard shortcut handler for the extension.
 */
export declare function createKeyboardShortcuts(server: WxtDevServer): KeyboardShortcutWatcher;
