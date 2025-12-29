import type { TargetBrowser } from '../../types';
/**
 * Load environment files based on the current mode and browser.
 */
export declare function loadEnv(mode: string, browser: TargetBrowser): import("dotenv-expand").DotenvExpandOutput;
