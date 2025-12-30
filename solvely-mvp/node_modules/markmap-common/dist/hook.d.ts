export type HookCallback<T extends unknown[]> = (...args: T) => void;
export declare class Hook<T extends unknown[]> {
    protected listeners: Array<HookCallback<T>>;
    tap(fn: HookCallback<T>): () => void;
    revoke(fn: HookCallback<T>): void;
    revokeAll(): void;
    call(...args: T): void;
}
