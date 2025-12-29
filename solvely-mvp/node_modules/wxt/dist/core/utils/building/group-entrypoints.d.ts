import { Entrypoint, EntrypointGroup } from '../../../types';
/**
 * Entrypoints are built in groups. HTML pages can all be built together in a single step,
 * content scripts must be build individually, etc.
 *
 * This function returns the entrypoints put into these types of groups.
 */
export declare function groupEntrypoints(entrypoints: Entrypoint[]): EntrypointGroup[];
