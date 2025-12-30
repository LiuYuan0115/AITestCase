/**
 * Checks if `predicate` returns truthy for all elements of the array.
 */
export declare function every<T>(array: T[], predicate: (item: T, index: number) => boolean): boolean;
/**
 * Returns true when any of the predicates return true;
 */
export declare function some<T>(array: T[], predicate: (item: T, index: number) => boolean): boolean;
/**
 * Convert an item or array to an array.
 */
export declare function toArray<T>(a: T | T[]): T[];
export declare function filterTruthy<T>(array: Array<T | undefined>): T[];
