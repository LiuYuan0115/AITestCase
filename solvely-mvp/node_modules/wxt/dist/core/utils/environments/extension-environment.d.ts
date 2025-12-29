import { Environment } from './environment';
export declare function createExtensionEnvironment(): Environment;
export declare function getExtensionEnvironmentGlobals(): {
    chrome: import("@webext-core/fake-browser").FakeBrowser;
    browser: import("@webext-core/fake-browser").FakeBrowser;
};
