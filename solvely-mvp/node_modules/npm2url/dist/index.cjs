'use strict';

const testPath = "npm2url/dist/index.cjs";
const defaultProviders = {
  jsdelivr: (path) => `https://cdn.jsdelivr.net/npm/${path}`,
  unpkg: (path) => `https://unpkg.com/${path}`
};
async function checkUrl(url, signal) {
  const res = await fetch(url, {
    signal
  });
  if (!res.ok) {
    throw res;
  }
  await res.text();
}
class UrlBuilder {
  constructor() {
    this.providers = { ...defaultProviders };
    this.provider = "jsdelivr";
  }
  /**
   * Get the fastest provider name.
   * If none of the providers returns a valid response within `timeout`, an error will be thrown.
   */
  async getFastestProvider(timeout = 5e3, path = testPath) {
    const controller = new AbortController();
    let timer = 0;
    try {
      return await new Promise((resolve, reject) => {
        Promise.all(
          Object.entries(this.providers).map(async ([name, factory]) => {
            try {
              await checkUrl(factory(path), controller.signal);
              resolve(name);
            } catch {
            }
          })
        ).then(() => reject(new Error("All providers failed")));
        timer = setTimeout(reject, timeout, new Error("Timed out"));
      });
    } finally {
      controller.abort();
      clearTimeout(timer);
    }
  }
  /**
   * Set the current provider to the fastest provider found by `getFastestProvider`.
   */
  async findFastestProvider(timeout, path) {
    this.provider = await this.getFastestProvider(timeout, path);
    return this.provider;
  }
  setProvider(name, factory) {
    if (factory) {
      this.providers[name] = factory;
    } else {
      delete this.providers[name];
    }
  }
  getFullUrl(path, provider = this.provider) {
    if (path.includes("://")) {
      return path;
    }
    const factory = this.providers[provider];
    if (!factory) {
      throw new Error(`Provider ${provider} not found`);
    }
    return factory(path);
  }
}
const urlBuilder = new UrlBuilder();

exports.UrlBuilder = UrlBuilder;
exports.urlBuilder = urlBuilder;
