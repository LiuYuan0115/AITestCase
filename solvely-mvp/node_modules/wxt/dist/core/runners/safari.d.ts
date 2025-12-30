import { ExtensionRunner } from '../../types';
/**
 * The Safari runner just logs a warning message because `web-ext` doesn't work with Safari.
 */
export declare function createSafariRunner(): ExtensionRunner;
