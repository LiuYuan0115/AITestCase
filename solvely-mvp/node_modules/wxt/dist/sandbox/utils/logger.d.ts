/**
 * Wrapper around `console` with a "[wxt]" prefix
 */
export declare const logger: {
    debug: (...args: any[]) => void;
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
};
