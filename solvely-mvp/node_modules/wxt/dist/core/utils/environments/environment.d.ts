export interface Environment {
    setup: () => () => void;
    run: <T>(fn: () => Promise<T>) => Promise<T>;
}
export declare function createEnvironment(getGlobals: () => EnvGlobals): Environment;
export type EnvGlobals = Record<string, any>;
export declare function getOgGlobals(envGlobals: EnvGlobals): EnvGlobals;
export declare function applyGlobals(globals: EnvGlobals): void;
