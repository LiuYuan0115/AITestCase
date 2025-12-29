/**
 * Read the project's package.json.
 *
 * TODO: look in root and up directories until it's found
 */
export declare function getPackageJson(): Promise<Partial<Record<string, any>> | undefined>;
