import { BuildOutput, BuildStepOutput, EntrypointGroup } from '../../../types';
/**
 * Compare the changed files vs the build output and determine what kind of reload needs to happen:
 *
 * - Do nothing
 *   - CSS or JS file associated with an HTML page is changed - this is handled automatically by the
 *     dev server
 *   - Change isn't used by any of the entrypoints
 * - Reload Content script
 *   - CSS or JS file associated with a content script
 *   - Background script will be told to reload the content script
 * - Reload HTML file
 *   - HTML file itself is saved - HMR doesn't handle this because the HTML pages are pre-rendered
 *   - Chrome is OK reloading the page when the HTML file is changed without reloading the whole
 *     extension. Not sure about firefox, this might need to change to an extension reload
 * - Reload extension
 *   - Background script is changed
 *   - Manifest is different
 * - Restart browser
 *   - web-ext.config.ts (runner config changes)
 * - Full dev server restart
 *   - wxt.config.ts (main config file)
 *   - modules/* (any file related to WXT modules)
 *   - .env (environment variable changed could effect build)
 */
export declare function detectDevChanges(changedFiles: string[], currentOutput: BuildOutput): DevModeChange;
/**
 * Contains information about what files changed, what needs rebuilt, and the type of reload that is
 * required.
 */
export type DevModeChange = NoChange | HtmlReload | ExtensionReload | ContentScriptReload | FullRestart | BrowserRestart;
interface NoChange {
    type: 'no-change';
}
interface RebuildChange {
    /**
     * The list of entrypoints that need rebuilt.
     */
    rebuildGroups: EntrypointGroup[];
    /**
     * The previous output stripped of any files are going to change.
     */
    cachedOutput: BuildOutput;
}
interface FullRestart {
    type: 'full-restart';
}
interface BrowserRestart {
    type: 'browser-restart';
}
interface HtmlReload extends RebuildChange {
    type: 'html-reload';
}
interface ExtensionReload extends RebuildChange {
    type: 'extension-reload';
}
interface ContentScriptReload extends RebuildChange {
    type: 'content-script-reload';
    changedSteps: BuildStepOutput[];
}
export {};
