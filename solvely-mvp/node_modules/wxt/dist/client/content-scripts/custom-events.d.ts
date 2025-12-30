export declare class WxtLocationChangeEvent extends Event {
    readonly newUrl: URL;
    readonly oldUrl: URL;
    static EVENT_NAME: string;
    constructor(newUrl: URL, oldUrl: URL);
}
/**
 * Returns an event name unique to the extension and content script that's running.
 */
export declare function getUniqueEventName(eventName: string): string;
