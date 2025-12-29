import { InlineConfig, ResolvedConfig, UserConfig, Logger, WxtCommand, WxtModuleWithMetadata } from '../types';
/**
 * Given an inline config, discover the config file if necessary, merge the results, resolve any
 * relative paths, and apply any defaults.
 *
 * Inline config always has priority over user config. Cli flags are passed as inline config if set.
 * If unset, undefined is passed in, letting this function decide default values.
 */
export declare function resolveConfig(inlineConfig: InlineConfig, command: WxtCommand): Promise<ResolvedConfig>;
export declare function mergeBuilderConfig(logger: Logger, inlineConfig: InlineConfig, userConfig: UserConfig): Promise<Pick<InlineConfig, 'vite'>>;
export declare function resolveWxtUserModules(root: string, modulesDir: string, modules?: string[]): Promise<WxtModuleWithMetadata<any>[]>;
