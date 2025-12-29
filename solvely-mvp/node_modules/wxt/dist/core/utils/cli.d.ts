export declare function defineCommand<TArgs extends any[]>(cb: (...args: TArgs) => void | boolean | Promise<void | boolean>, options?: {
    disableFinishedLog?: boolean;
}): (...args: TArgs) => Promise<void>;
