/**
 * Only write the contents to a file if it results in a change. This prevents unnecessary file
 * watchers from being triggered, like WXT's dev server or the TS language server in editors.
 *
 * @param file The file to write to.
 * @param newContents The new text content to write.
 */
export declare function writeFileIfDifferent(file: string, newContents: string): Promise<void>;
/**
 * Get all the files in the project's public directory. Returned paths are relative to the
 * `config.publicDir`.
 */
export declare function getPublicFiles(): Promise<string[]>;
