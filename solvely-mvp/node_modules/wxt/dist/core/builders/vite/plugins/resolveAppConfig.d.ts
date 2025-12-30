import type * as vite from 'vite';
import { ResolvedConfig } from '../../../../types';
/**
 * When importing `virtual:app-config`, resolve it to the `app.config.ts` file in the project.
 */
export declare function resolveAppConfig(config: ResolvedConfig): vite.Plugin;
