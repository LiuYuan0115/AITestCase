import { Entrypoint } from '../../../types';
/**
 * Return entrypoints and their configuration by looking through the project's files.
 */
export declare function findEntrypoints(): Promise<Entrypoint[]>;
