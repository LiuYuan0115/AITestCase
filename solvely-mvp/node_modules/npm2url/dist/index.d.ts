declare class UrlBuilder {
    providers: {
        [x: string]: (path: string) => string;
    };
    provider: string;
    /**
     * Get the fastest provider name.
     * If none of the providers returns a valid response within `timeout`, an error will be thrown.
     */
    getFastestProvider(timeout?: number, path?: string): Promise<string>;
    /**
     * Set the current provider to the fastest provider found by `getFastestProvider`.
     */
    findFastestProvider(timeout?: number, path?: string): Promise<string>;
    setProvider(name: string, factory: ((path: string) => string) | null): void;
    getFullUrl(path: string, provider?: string): string;
}
declare const urlBuilder: UrlBuilder;

export { UrlBuilder, urlBuilder };
