import { Browser } from '@wxt-dev/browser';

declare const storage: WxtStorage;
interface WxtStorage {
    /**
     * Get an item from storage, or return `null` if it doesn't exist.
     *
     * @example
     * await storage.getItem<number>("local:installDate");
     */
    getItem<TValue>(key: StorageItemKey, opts: GetItemOptions<TValue> & {
        fallback: TValue;
    }): Promise<TValue>;
    getItem<TValue>(key: StorageItemKey, opts?: GetItemOptions<TValue>): Promise<TValue | null>;
    /**
     * Get multiple items from storage. The return order is guaranteed to be the same as the order
     * requested.
     *
     * @example
     * await storage.getItems(["local:installDate", "session:someCounter"]);
     */
    getItems(keys: Array<StorageItemKey | WxtStorageItem<any, any> | {
        key: StorageItemKey;
        options?: GetItemOptions<any>;
    }>): Promise<Array<{
        key: StorageItemKey;
        value: any;
    }>>;
    /**
     * Return an object containing metadata about the key. Object is stored at `key + "$"`. If value
     * is not an object, it returns an empty object.
     *
     * @example
     * await storage.getMeta("local:installDate");
     */
    getMeta<T extends Record<string, unknown>>(key: StorageItemKey): Promise<T>;
    /**
     * Get the metadata of multiple storage items.
     *
     * @param items List of keys or items to get the metadata of.
     * @returns An array containing storage keys and their metadata.
     */
    getMetas(keys: Array<StorageItemKey | WxtStorageItem<any, any>>): Promise<Array<{
        key: StorageItemKey;
        meta: any;
    }>>;
    /**
     * Set a value in storage. Setting a value to `null` or `undefined` is equivalent to calling
     * `removeItem`.
     *
     * @example
     * await storage.setItem<number>("local:installDate", Date.now());
     */
    setItem<T>(key: StorageItemKey, value: T | null): Promise<void>;
    /**
     * Set multiple values in storage. If a value is set to `null` or `undefined`, the key is removed.
     *
     * @example
     * await storage.setItem([
     *   { key: "local:installDate", value: Date.now() },
     *   { key: "session:someCounter, value: 5 },
     * ]);
     */
    setItems(values: Array<{
        key: StorageItemKey;
        value: any;
    } | {
        item: WxtStorageItem<any, any>;
        value: any;
    }>): Promise<void>;
    /**
     * Sets metadata properties. If some properties are already set, but are not included in the
     * `properties` parameter, they will not be removed.
     *
     * @example
     * await storage.setMeta("local:installDate", { appVersion });
     */
    setMeta<T extends Record<string, unknown>>(key: StorageItemKey, properties: T | null): Promise<void>;
    /**
     * Set the metadata of multiple storage items.
     *
     * @param items List of storage keys or items and metadata to set for each.
     */
    setMetas(metas: Array<{
        key: StorageItemKey;
        meta: Record<string, any>;
    } | {
        item: WxtStorageItem<any, any>;
        meta: Record<string, any>;
    }>): Promise<void>;
    /**
     * Removes an item from storage.
     *
     * @example
     * await storage.removeItem("local:installDate");
     */
    removeItem(key: StorageItemKey, opts?: RemoveItemOptions): Promise<void>;
    /**
     * Remove a list of keys from storage.
     */
    removeItems(keys: Array<StorageItemKey | WxtStorageItem<any, any> | {
        key: StorageItemKey;
        options?: RemoveItemOptions;
    } | {
        item: WxtStorageItem<any, any>;
        options?: RemoveItemOptions;
    }>): Promise<void>;
    /**
     * Removes all items from the provided storage area.
     */
    clear(base: StorageArea): Promise<void>;
    /**
     * Remove the entire metadata for a key, or specific properties by name.
     *
     * @example
     * // Remove all metadata properties from the item
     * await storage.removeMeta("local:installDate");
     *
     * // Remove only specific the "v" field
     * await storage.removeMeta("local:installDate", "v")
     */
    removeMeta(key: StorageItemKey, properties?: string | string[]): Promise<void>;
    /**
     * Return all the items in storage.
     */
    snapshot(base: StorageArea, opts?: SnapshotOptions): Promise<Record<string, unknown>>;
    /**
     * Restores the results of `snapshot`. If new properties have been saved since the snapshot, they are
     * not overridden. Only values existing in the snapshot are overridden.
     */
    restoreSnapshot(base: StorageArea, data: any): Promise<void>;
    /**
     * Watch for changes to a specific key in storage.
     */
    watch<T>(key: StorageItemKey, cb: WatchCallback<T | null>): Unwatch;
    /**
     * Remove all watch listeners.
     */
    unwatch(): void;
    /**
     * Define a storage item with a default value, type, or versioning.
     *
     * Read full docs: https://wxt.dev/storage.html#defining-storage-items
     */
    defineItem<TValue, TMetadata extends Record<string, unknown> = {}>(key: StorageItemKey): WxtStorageItem<TValue | null, TMetadata>;
    defineItem<TValue, TMetadata extends Record<string, unknown> = {}>(key: StorageItemKey, options: WxtStorageItemOptions<TValue> & {
        fallback: TValue;
    }): WxtStorageItem<TValue, TMetadata>;
    defineItem<TValue, TMetadata extends Record<string, unknown> = {}>(key: StorageItemKey, options: WxtStorageItemOptions<TValue> & {
        defaultValue: TValue;
    }): WxtStorageItem<TValue, TMetadata>;
    defineItem<TValue, TMetadata extends Record<string, unknown> = {}>(key: StorageItemKey, options: WxtStorageItemOptions<TValue>): WxtStorageItem<TValue | null, TMetadata>;
}
interface WxtStorageItem<TValue, TMetadata extends Record<string, unknown>> {
    /**
     * The storage key passed when creating the storage item.
     */
    key: StorageItemKey;
    /**
     * @deprecated Renamed to fallback, use it instead.
     */
    defaultValue: TValue;
    /**
     * The value provided by the `fallback` option.
     */
    fallback: TValue;
    /**
     * Get the latest value from storage.
     */
    getValue(): Promise<TValue>;
    /**
     * Get metadata.
     */
    getMeta(): Promise<NullablePartial<TMetadata>>;
    /**
     * Set the value in storage.
     */
    setValue(value: TValue): Promise<void>;
    /**
     * Set metadata properties.
     */
    setMeta(properties: NullablePartial<TMetadata>): Promise<void>;
    /**
     * Remove the value from storage.
     */
    removeValue(opts?: RemoveItemOptions): Promise<void>;
    /**
     * Remove all metadata or certain properties from metadata.
     */
    removeMeta(properties?: string[]): Promise<void>;
    /**
     * Listen for changes to the value in storage.
     */
    watch(cb: WatchCallback<TValue>): Unwatch;
    /**
     * If there are migrations defined on the storage item, migrate to the latest version.
     *
     * **This function is ran automatically whenever the extension updates**, so you don't have to call it
     * manually.
     */
    migrate(): Promise<void>;
}
type StorageArea = 'local' | 'session' | 'sync' | 'managed';
type StorageItemKey = `${StorageArea}:${string}`;
interface GetItemOptions<T> {
    /**
     * @deprecated Renamed to `fallback`, use it instead.
     */
    defaultValue?: T;
    /**
     * Default value returned when `getItem` would otherwise return `null`.
     */
    fallback?: T;
}
interface RemoveItemOptions {
    /**
     * Optionally remove metadata when deleting a key.
     *
     * @default false
     */
    removeMeta?: boolean;
}
interface SnapshotOptions {
    /**
     * Exclude a list of keys. The storage area prefix should be removed since the snapshot is for a
     * specific storage area already.
     */
    excludeKeys?: string[];
}
interface WxtStorageItemOptions<T> {
    /**
     * @deprecated Renamed to `fallback`, use it instead.
     */
    defaultValue?: T;
    /**
     * Default value returned when `getValue` would otherwise return `null`.
     */
    fallback?: T;
    /**
     * If passed, a value in storage will be initialized immediately after
     * defining the storage item. This function returns the value that will be
     * saved to storage during the initialization process if a value doesn't
     * already exist.
     */
    init?: () => T | Promise<T>;
    /**
     * Provide a version number for the storage item to enable migrations. When changing the version
     * in the future, migration functions will be ran on application startup.
     */
    version?: number;
    /**
     * A map of version numbers to the functions used to migrate the data to that version.
     */
    migrations?: Record<number, (oldValue: any) => any>;
    /**
     * Print debug logs, such as migration process.
     * @default false
     */
    debug?: boolean;
    /**
     * A callback function that runs on migration complete.
     */
    onMigrationComplete?: (migratedValue: T, targetVersion: number) => void;
}
type StorageAreaChanges = {
    [key: string]: Browser.storage.StorageChange;
};
/**
 * Same as `Partial`, but includes `| null`. It makes all the properties of an object optional and
 * nullable.
 */
type NullablePartial<T> = {
    [key in keyof T]+?: T[key] | undefined | null;
};
/**
 * Callback called when a value in storage is changed.
 */
type WatchCallback<T> = (newValue: T, oldValue: T) => void;
/**
 * Call to remove a watch listener
 */
type Unwatch = () => void;
declare class MigrationError extends Error {
    key: string;
    version: number;
    constructor(key: string, version: number, options?: ErrorOptions);
}

export { MigrationError, storage };
export type { GetItemOptions, RemoveItemOptions, SnapshotOptions, StorageArea, StorageAreaChanges, StorageItemKey, Unwatch, WatchCallback, WxtStorage, WxtStorageItem, WxtStorageItemOptions };
