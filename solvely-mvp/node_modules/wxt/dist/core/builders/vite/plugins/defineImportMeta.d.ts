/**
 * Overrides definitions for `import.meta.*`
 *
 * - `import.meta.url`: Without this, background service workers crash trying to access
 *   `document.location`, see https://github.com/wxt-dev/wxt/issues/392
 */
export declare function defineImportMeta(): {
    name: string;
    config(): {
        define: {
            'import.meta.url': string;
        };
    };
};
