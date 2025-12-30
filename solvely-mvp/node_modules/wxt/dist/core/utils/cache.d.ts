import { FsCache } from '../../types';
/**
 * A basic file system cache stored at `<srcDir>/.wxt/cache/<key>`. Just caches a string in a
 * file for the given key.
 *
 * @param srcDir Absolute path to source directory. See `InternalConfig.srcDir`
 */
export declare function createFsCache(wxtDir: string): FsCache;
