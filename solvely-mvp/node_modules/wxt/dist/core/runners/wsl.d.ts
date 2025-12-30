import { ExtensionRunner } from '../../types';
/**
 * The WSL runner just logs a warning message because `web-ext` doesn't work in WSL.
 */
export declare function createWslRunner(): ExtensionRunner;
