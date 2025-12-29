import { InlineConfig, Wxt, WxtCommand } from '../types';
/**
 * Global variable set once `createWxt` is called once. Since this variable is used everywhere, this
 * global can be used instead of passing the variable as a function parameter everywhere.
 */
export declare let wxt: Wxt;
/**
 * Create and register a global instance of the Wxt interface for use throughout the project.
 */
export declare function registerWxt(command: WxtCommand, inlineConfig?: InlineConfig): Promise<void>;
export declare function initWxtModules(): Promise<void>;
/**
 * Unloads WXT modules.
 */
export declare function deinitWxtModules(): void;
/**
 * @internal ONLY USE FOR TESTING.
 *
 * @example
 * setWxtForTesting(fakeWxt({ ... }));
 * // Or use the shorthand
 * setFakeWxt({ ... })
 */
export declare function setWxtForTesting(testInstance: Wxt): void;
