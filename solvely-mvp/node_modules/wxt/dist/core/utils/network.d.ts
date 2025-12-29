import { ResolvedConfig } from '../../types';
export declare function isOnline(): Promise<boolean>;
/**
 * Fetches a URL with a simple GET request. Grabs it from cache if it doesn't exist, or throws an
 * error if it can't be resolved via the network or cache.
 */
export declare function fetchCached(url: string, config: ResolvedConfig): Promise<string>;
