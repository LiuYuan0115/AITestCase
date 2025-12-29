import { ResolvedConfig } from '../../types';
export declare function getGlobals(config: ResolvedConfig): Array<{
    name: string;
    value: any;
    type: string;
}>;
export declare function getEntrypointGlobals(entrypointName: string): {
    name: string;
    value: string;
    type: string;
}[];
