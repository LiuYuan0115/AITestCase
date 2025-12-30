import type * as vite from 'vite';
import { EntrypointGroup } from '../../../../types';
/**
 * Define a set of global variables specific to an entrypoint.
 */
export declare function entrypointGroupGlobals(entrypointGroup: EntrypointGroup): vite.PluginOption;
