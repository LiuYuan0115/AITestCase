import { Dependency } from '../../types';
import { WxtPackageManagerImpl } from './types';
export declare const npm: WxtPackageManagerImpl;
export declare function flattenNpmListOutput(projects: NpmListProject[]): Dependency[];
export declare function dedupeDependencies(dependencies: Dependency[]): Dependency[];
export interface NpmListProject {
    name: string;
    dependencies?: Record<string, NpmListDependency>;
    devDependencies?: Record<string, NpmListDependency>;
}
export interface NpmListDependency {
    version: string;
    resolved?: string;
    overridden?: boolean;
    dependencies?: Record<string, NpmListDependency>;
    devDependencies?: Record<string, NpmListDependency>;
}
