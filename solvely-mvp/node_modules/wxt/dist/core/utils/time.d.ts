export declare function formatDuration(duration: number): string;
/**
 * Add a timeout to a promise.
 */
export declare function withTimeout<T>(promise: Promise<T>, duration: number): Promise<T>;
/**
 * @deprecated Don't use in production, just for testing and slowing things down.
 */
export declare function sleep(ms: number): Promise<void>;
