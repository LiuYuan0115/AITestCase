import ManyKeysMap from 'many-keys-map';
import { defu } from 'defu';
import { isExist } from './detectors.mjs';

const getDefaultOptions = () => ({
  target: globalThis.document,
  unifyProcess: true,
  detector: isExist,
  observeConfigs: {
    childList: true,
    subtree: true,
    attributes: true
  },
  signal: void 0,
  customMatcher: void 0
});
const mergeOptions = (userSideOptions, defaultOptions) => {
  return defu(userSideOptions, defaultOptions);
};

const unifyCache = new ManyKeysMap();
function createWaitElement(instanceOptions) {
  const { defaultOptions } = instanceOptions;
  return (selector, options) => {
    const {
      target,
      unifyProcess,
      observeConfigs,
      detector,
      signal,
      customMatcher
    } = mergeOptions(options, defaultOptions);
    const unifyPromiseKey = [
      selector,
      target,
      unifyProcess,
      observeConfigs,
      detector,
      signal,
      customMatcher
    ];
    const cachedPromise = unifyCache.get(unifyPromiseKey);
    if (unifyProcess && cachedPromise) {
      return cachedPromise;
    }
    const detectPromise = new Promise(
      // biome-ignore lint/suspicious/noAsyncPromiseExecutor: avoid nesting promise
      async (resolve, reject) => {
        if (signal?.aborted) {
          return reject(signal.reason);
        }
        const observer = new MutationObserver(
          async (mutations) => {
            for (const _ of mutations) {
              if (signal?.aborted) {
                observer.disconnect();
                break;
              }
              const detectResult2 = await detectElement({
                selector,
                target,
                detector,
                customMatcher
              });
              if (detectResult2.isDetected) {
                observer.disconnect();
                resolve(detectResult2.result);
                break;
              }
            }
          }
        );
        signal?.addEventListener(
          "abort",
          () => {
            observer.disconnect();
            return reject(signal.reason);
          },
          { once: true }
        );
        const detectResult = await detectElement({
          selector,
          target,
          detector,
          customMatcher
        });
        if (detectResult.isDetected) {
          return resolve(detectResult.result);
        }
        observer.observe(target, observeConfigs);
      }
    ).finally(() => {
      unifyCache.delete(unifyPromiseKey);
    });
    unifyCache.set(unifyPromiseKey, detectPromise);
    return detectPromise;
  };
}
async function detectElement({
  target,
  selector,
  detector,
  customMatcher
}) {
  const element = customMatcher ? customMatcher(selector) : target.querySelector(selector);
  return await detector(element);
}
const waitElement = createWaitElement({
  defaultOptions: getDefaultOptions()
});

export { createWaitElement, getDefaultOptions, waitElement };
