import { dequal } from 'dequal/lite';
import { Mutex } from 'async-mutex';
import { browser } from '@wxt-dev/browser';

const storage = createStorage();
function createStorage() {
  const drivers = {
    local: createDriver("local"),
    session: createDriver("session"),
    sync: createDriver("sync"),
    managed: createDriver("managed")
  };
  const getDriver = (area) => {
    const driver = drivers[area];
    if (driver == null) {
      const areaNames = Object.keys(drivers).join(", ");
      throw Error(`Invalid area "${area}". Options: ${areaNames}`);
    }
    return driver;
  };
  const resolveKey = (key) => {
    const deliminatorIndex = key.indexOf(":");
    const driverArea = key.substring(0, deliminatorIndex);
    const driverKey = key.substring(deliminatorIndex + 1);
    if (driverKey == null)
      throw Error(
        `Storage key should be in the form of "area:key", but received "${key}"`
      );
    return {
      driverArea,
      driverKey,
      driver: getDriver(driverArea)
    };
  };
  const getMetaKey = (key) => key + "$";
  const mergeMeta = (oldMeta, newMeta) => {
    const newFields = { ...oldMeta };
    Object.entries(newMeta).forEach(([key, value]) => {
      if (value == null) delete newFields[key];
      else newFields[key] = value;
    });
    return newFields;
  };
  const getValueOrFallback = (value, fallback) => value ?? fallback ?? null;
  const getMetaValue = (properties) => typeof properties === "object" && !Array.isArray(properties) ? properties : {};
  const getItem = async (driver, driverKey, opts) => {
    const res = await driver.getItem(driverKey);
    return getValueOrFallback(res, opts?.fallback ?? opts?.defaultValue);
  };
  const getMeta = async (driver, driverKey) => {
    const metaKey = getMetaKey(driverKey);
    const res = await driver.getItem(metaKey);
    return getMetaValue(res);
  };
  const setItem = async (driver, driverKey, value) => {
    await driver.setItem(driverKey, value ?? null);
  };
  const setMeta = async (driver, driverKey, properties) => {
    const metaKey = getMetaKey(driverKey);
    const existingFields = getMetaValue(await driver.getItem(metaKey));
    await driver.setItem(metaKey, mergeMeta(existingFields, properties));
  };
  const removeItem = async (driver, driverKey, opts) => {
    await driver.removeItem(driverKey);
    if (opts?.removeMeta) {
      const metaKey = getMetaKey(driverKey);
      await driver.removeItem(metaKey);
    }
  };
  const removeMeta = async (driver, driverKey, properties) => {
    const metaKey = getMetaKey(driverKey);
    if (properties == null) {
      await driver.removeItem(metaKey);
    } else {
      const newFields = getMetaValue(await driver.getItem(metaKey));
      [properties].flat().forEach((field) => delete newFields[field]);
      await driver.setItem(metaKey, newFields);
    }
  };
  const watch = (driver, driverKey, cb) => {
    return driver.watch(driverKey, cb);
  };
  const storage2 = {
    getItem: async (key, opts) => {
      const { driver, driverKey } = resolveKey(key);
      return await getItem(driver, driverKey, opts);
    },
    getItems: async (keys) => {
      const areaToKeyMap = /* @__PURE__ */ new Map();
      const keyToOptsMap = /* @__PURE__ */ new Map();
      const orderedKeys = [];
      keys.forEach((key) => {
        let keyStr;
        let opts;
        if (typeof key === "string") {
          keyStr = key;
        } else if ("getValue" in key) {
          keyStr = key.key;
          opts = { fallback: key.fallback };
        } else {
          keyStr = key.key;
          opts = key.options;
        }
        orderedKeys.push(keyStr);
        const { driverArea, driverKey } = resolveKey(keyStr);
        const areaKeys = areaToKeyMap.get(driverArea) ?? [];
        areaToKeyMap.set(driverArea, areaKeys.concat(driverKey));
        keyToOptsMap.set(keyStr, opts);
      });
      const resultsMap = /* @__PURE__ */ new Map();
      await Promise.all(
        Array.from(areaToKeyMap.entries()).map(async ([driverArea, keys2]) => {
          const driverResults = await drivers[driverArea].getItems(keys2);
          driverResults.forEach((driverResult) => {
            const key = `${driverArea}:${driverResult.key}`;
            const opts = keyToOptsMap.get(key);
            const value = getValueOrFallback(
              driverResult.value,
              opts?.fallback ?? opts?.defaultValue
            );
            resultsMap.set(key, value);
          });
        })
      );
      return orderedKeys.map((key) => ({
        key,
        value: resultsMap.get(key)
      }));
    },
    getMeta: async (key) => {
      const { driver, driverKey } = resolveKey(key);
      return await getMeta(driver, driverKey);
    },
    getMetas: async (args) => {
      const keys = args.map((arg) => {
        const key = typeof arg === "string" ? arg : arg.key;
        const { driverArea, driverKey } = resolveKey(key);
        return {
          key,
          driverArea,
          driverKey,
          driverMetaKey: getMetaKey(driverKey)
        };
      });
      const areaToDriverMetaKeysMap = keys.reduce((map, key) => {
        map[key.driverArea] ??= [];
        map[key.driverArea].push(key);
        return map;
      }, {});
      const resultsMap = {};
      await Promise.all(
        Object.entries(areaToDriverMetaKeysMap).map(async ([area, keys2]) => {
          const areaRes = await browser.storage[area].get(
            keys2.map((key) => key.driverMetaKey)
          );
          keys2.forEach((key) => {
            resultsMap[key.key] = areaRes[key.driverMetaKey] ?? {};
          });
        })
      );
      return keys.map((key) => ({
        key: key.key,
        meta: resultsMap[key.key]
      }));
    },
    setItem: async (key, value) => {
      const { driver, driverKey } = resolveKey(key);
      await setItem(driver, driverKey, value);
    },
    setItems: async (items) => {
      const areaToKeyValueMap = {};
      items.forEach((item) => {
        const { driverArea, driverKey } = resolveKey(
          "key" in item ? item.key : item.item.key
        );
        areaToKeyValueMap[driverArea] ??= [];
        areaToKeyValueMap[driverArea].push({
          key: driverKey,
          value: item.value
        });
      });
      await Promise.all(
        Object.entries(areaToKeyValueMap).map(async ([driverArea, values]) => {
          const driver = getDriver(driverArea);
          await driver.setItems(values);
        })
      );
    },
    setMeta: async (key, properties) => {
      const { driver, driverKey } = resolveKey(key);
      await setMeta(driver, driverKey, properties);
    },
    setMetas: async (items) => {
      const areaToMetaUpdatesMap = {};
      items.forEach((item) => {
        const { driverArea, driverKey } = resolveKey(
          "key" in item ? item.key : item.item.key
        );
        areaToMetaUpdatesMap[driverArea] ??= [];
        areaToMetaUpdatesMap[driverArea].push({
          key: driverKey,
          properties: item.meta
        });
      });
      await Promise.all(
        Object.entries(areaToMetaUpdatesMap).map(
          async ([storageArea, updates]) => {
            const driver = getDriver(storageArea);
            const metaKeys = updates.map(({ key }) => getMetaKey(key));
            const existingMetas = await driver.getItems(metaKeys);
            const existingMetaMap = Object.fromEntries(
              existingMetas.map(({ key, value }) => [key, getMetaValue(value)])
            );
            const metaUpdates = updates.map(({ key, properties }) => {
              const metaKey = getMetaKey(key);
              return {
                key: metaKey,
                value: mergeMeta(existingMetaMap[metaKey] ?? {}, properties)
              };
            });
            await driver.setItems(metaUpdates);
          }
        )
      );
    },
    removeItem: async (key, opts) => {
      const { driver, driverKey } = resolveKey(key);
      await removeItem(driver, driverKey, opts);
    },
    removeItems: async (keys) => {
      const areaToKeysMap = {};
      keys.forEach((key) => {
        let keyStr;
        let opts;
        if (typeof key === "string") {
          keyStr = key;
        } else if ("getValue" in key) {
          keyStr = key.key;
        } else if ("item" in key) {
          keyStr = key.item.key;
          opts = key.options;
        } else {
          keyStr = key.key;
          opts = key.options;
        }
        const { driverArea, driverKey } = resolveKey(keyStr);
        areaToKeysMap[driverArea] ??= [];
        areaToKeysMap[driverArea].push(driverKey);
        if (opts?.removeMeta) {
          areaToKeysMap[driverArea].push(getMetaKey(driverKey));
        }
      });
      await Promise.all(
        Object.entries(areaToKeysMap).map(async ([driverArea, keys2]) => {
          const driver = getDriver(driverArea);
          await driver.removeItems(keys2);
        })
      );
    },
    clear: async (base) => {
      const driver = getDriver(base);
      await driver.clear();
    },
    removeMeta: async (key, properties) => {
      const { driver, driverKey } = resolveKey(key);
      await removeMeta(driver, driverKey, properties);
    },
    snapshot: async (base, opts) => {
      const driver = getDriver(base);
      const data = await driver.snapshot();
      opts?.excludeKeys?.forEach((key) => {
        delete data[key];
        delete data[getMetaKey(key)];
      });
      return data;
    },
    restoreSnapshot: async (base, data) => {
      const driver = getDriver(base);
      await driver.restoreSnapshot(data);
    },
    watch: (key, cb) => {
      const { driver, driverKey } = resolveKey(key);
      return watch(driver, driverKey, cb);
    },
    unwatch() {
      Object.values(drivers).forEach((driver) => {
        driver.unwatch();
      });
    },
    defineItem: (key, opts) => {
      const { driver, driverKey } = resolveKey(key);
      const {
        version: targetVersion = 1,
        migrations = {},
        onMigrationComplete,
        debug = false
      } = opts ?? {};
      if (targetVersion < 1) {
        throw Error(
          "Storage item version cannot be less than 1. Initial versions should be set to 1, not 0."
        );
      }
      const migrate = async () => {
        const driverMetaKey = getMetaKey(driverKey);
        const [{ value }, { value: meta }] = await driver.getItems([
          driverKey,
          driverMetaKey
        ]);
        if (value == null) return;
        const currentVersion = meta?.v ?? 1;
        if (currentVersion > targetVersion) {
          throw Error(
            `Version downgrade detected (v${currentVersion} -> v${targetVersion}) for "${key}"`
          );
        }
        if (currentVersion === targetVersion) {
          return;
        }
        if (debug === true) {
          console.debug(
            `[@wxt-dev/storage] Running storage migration for ${key}: v${currentVersion} -> v${targetVersion}`
          );
        }
        const migrationsToRun = Array.from(
          { length: targetVersion - currentVersion },
          (_, i) => currentVersion + i + 1
        );
        let migratedValue = value;
        for (const migrateToVersion of migrationsToRun) {
          try {
            migratedValue = await migrations?.[migrateToVersion]?.(migratedValue) ?? migratedValue;
            if (debug === true) {
              console.debug(
                `[@wxt-dev/storage] Storage migration processed for version: v${migrateToVersion}`
              );
            }
          } catch (err) {
            throw new MigrationError(key, migrateToVersion, {
              cause: err
            });
          }
        }
        await driver.setItems([
          { key: driverKey, value: migratedValue },
          { key: driverMetaKey, value: { ...meta, v: targetVersion } }
        ]);
        if (debug === true) {
          console.debug(
            `[@wxt-dev/storage] Storage migration completed for ${key} v${targetVersion}`,
            { migratedValue }
          );
        }
        onMigrationComplete?.(migratedValue, targetVersion);
      };
      const migrationsDone = opts?.migrations == null ? Promise.resolve() : migrate().catch((err) => {
        console.error(
          `[@wxt-dev/storage] Migration failed for ${key}`,
          err
        );
      });
      const initMutex = new Mutex();
      const getFallback = () => opts?.fallback ?? opts?.defaultValue ?? null;
      const getOrInitValue = () => initMutex.runExclusive(async () => {
        const value = await driver.getItem(driverKey);
        if (value != null || opts?.init == null) return value;
        const newValue = await opts.init();
        await driver.setItem(driverKey, newValue);
        return newValue;
      });
      migrationsDone.then(getOrInitValue);
      return {
        key,
        get defaultValue() {
          return getFallback();
        },
        get fallback() {
          return getFallback();
        },
        getValue: async () => {
          await migrationsDone;
          if (opts?.init) {
            return await getOrInitValue();
          } else {
            return await getItem(driver, driverKey, opts);
          }
        },
        getMeta: async () => {
          await migrationsDone;
          return await getMeta(driver, driverKey);
        },
        setValue: async (value) => {
          await migrationsDone;
          return await setItem(driver, driverKey, value);
        },
        setMeta: async (properties) => {
          await migrationsDone;
          return await setMeta(driver, driverKey, properties);
        },
        removeValue: async (opts2) => {
          await migrationsDone;
          return await removeItem(driver, driverKey, opts2);
        },
        removeMeta: async (properties) => {
          await migrationsDone;
          return await removeMeta(driver, driverKey, properties);
        },
        watch: (cb) => watch(
          driver,
          driverKey,
          (newValue, oldValue) => cb(newValue ?? getFallback(), oldValue ?? getFallback())
        ),
        migrate
      };
    }
  };
  return storage2;
}
function createDriver(storageArea) {
  const getStorageArea = () => {
    if (browser.runtime == null) {
      throw Error(
        [
          "'wxt/storage' must be loaded in a web extension environment",
          "\n - If thrown during a build, see https://github.com/wxt-dev/wxt/issues/371",
          " - If thrown during tests, mock 'wxt/browser' correctly. See https://wxt.dev/guide/go-further/testing.html\n"
        ].join("\n")
      );
    }
    if (browser.storage == null) {
      throw Error(
        "You must add the 'storage' permission to your manifest to use 'wxt/storage'"
      );
    }
    const area = browser.storage[storageArea];
    if (area == null)
      throw Error(`"browser.storage.${storageArea}" is undefined`);
    return area;
  };
  const watchListeners = /* @__PURE__ */ new Set();
  return {
    getItem: async (key) => {
      const res = await getStorageArea().get(key);
      return res[key];
    },
    getItems: async (keys) => {
      const result = await getStorageArea().get(keys);
      return keys.map((key) => ({ key, value: result[key] ?? null }));
    },
    setItem: async (key, value) => {
      if (value == null) {
        await getStorageArea().remove(key);
      } else {
        await getStorageArea().set({ [key]: value });
      }
    },
    setItems: async (values) => {
      const map = values.reduce(
        (map2, { key, value }) => {
          map2[key] = value;
          return map2;
        },
        {}
      );
      await getStorageArea().set(map);
    },
    removeItem: async (key) => {
      await getStorageArea().remove(key);
    },
    removeItems: async (keys) => {
      await getStorageArea().remove(keys);
    },
    clear: async () => {
      await getStorageArea().clear();
    },
    snapshot: async () => {
      return await getStorageArea().get();
    },
    restoreSnapshot: async (data) => {
      await getStorageArea().set(data);
    },
    watch(key, cb) {
      const listener = (changes) => {
        const change = changes[key];
        if (change == null) return;
        if (dequal(change.newValue, change.oldValue)) return;
        cb(change.newValue ?? null, change.oldValue ?? null);
      };
      getStorageArea().onChanged.addListener(listener);
      watchListeners.add(listener);
      return () => {
        getStorageArea().onChanged.removeListener(listener);
        watchListeners.delete(listener);
      };
    },
    unwatch() {
      watchListeners.forEach((listener) => {
        getStorageArea().onChanged.removeListener(listener);
      });
      watchListeners.clear();
    }
  };
}
class MigrationError extends Error {
  constructor(key, version, options) {
    super(`v${version} migration failed for "${key}"`, options);
    this.key = key;
    this.version = version;
  }
}

export { MigrationError, storage };
