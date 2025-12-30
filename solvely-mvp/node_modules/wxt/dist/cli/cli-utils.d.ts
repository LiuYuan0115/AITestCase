import { CAC, Command } from 'cac';
/**
 * Wrap an action handler to add a timer, error handling, and maybe enable debug mode.
 */
export declare function wrapAction(cb: (...args: any[]) => void | {
    isOngoing?: boolean;
} | Promise<void | {
    isOngoing?: boolean;
}>, options?: {
    disableFinishedLog?: boolean;
}): (...args: any[]) => Promise<void>;
/**
 * Array flags, when not passed, are either `undefined` or `[undefined]`. This function filters out
 * the
 */
export declare function getArrayFromFlags<T>(flags: any, name: string): T[] | undefined;
/**
 * @param base Command to add this one to
 * @param name The command name to add
 * @param alias The CLI tool being aliased
 * @param bin The CLI tool binary name. Usually the same as the alias
 * @param docsUrl URL to the docs for the aliased CLI tool
 */
export declare function createAliasedCommand(base: CAC, name: string, alias: string, bin: string, docsUrl: string): void;
export declare function isAliasedCommand(command: Command | undefined): boolean;
