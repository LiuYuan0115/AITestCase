import { BuildOutput } from '../../../types';
/**
 * Builds the extension based on an internal config. No more config discovery is performed, the
 * build is based on exactly what is passed in.
 *
 * This function:
 * 1. Cleans the output directory
 * 2. Executes the rebuild function with a blank previous output so everything is built (see
 *    `rebuild` for more details)
 * 3. Prints the summary
 */
export declare function internalBuild(): Promise<BuildOutput>;
