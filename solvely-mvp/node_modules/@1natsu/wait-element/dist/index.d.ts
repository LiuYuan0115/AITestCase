import { Q as QuerySelectorReturn, N as NodeLike, D as Detector, a as DefaultResult } from './shared/wait-element.099d981e.js';

interface Options<Result = unknown, QuerySelectorResult extends QuerySelectorReturn = QuerySelectorReturn> {
    /**
     * @type HTMLElement
     * @default document
     * @description Specify a parent node (specify MutationObserve target).
     * 	When you know the parent node of the element you want to detect.
     *
     * * Please also refer to the [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
     */
    target: NodeLike;
    /**
     * @type boolean
     * @default true
     * @description Unifies the process of finding an element. If set `true`, increases efficiency. Unify the same arguments(includes options) with each other.
     */
    unifyProcess: boolean;
    /**
     * @type MutationObserverInit
     * @default
     * {
        childList: true,
        subtree: true,
        attributes: true,
        }
     * @description
     * [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
     */
    observeConfigs: MutationObserverInit;
    /**
     * @type function
     * @default isExist
     * @description Can define functions for resolve conditions.
     */
    detector: Detector<Result, QuerySelectorResult>;
    /**
     * @type AbortSignal
     * @default undefined
     * @description
     * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
     */
    signal: undefined | AbortSignal;
    /**
     * @type function
     * @param selector string
     * @description Use a matcher other than querySelector
     */
    customMatcher: ((selector: string) => QuerySelectorResult) | undefined;
}
type UserSideOptions<Result = unknown, QuerySelectorResult extends QuerySelectorReturn = QuerySelectorReturn> = Partial<Options<Result, QuerySelectorResult>>;
type InstanceOptions<Result = unknown, QuerySelectorResult extends QuerySelectorReturn = QuerySelectorReturn> = {
    defaultOptions: Options<Result, QuerySelectorResult>;
};
type DefaultOptions<QuerySelectorResult extends QuerySelectorReturn> = Options<DefaultResult, QuerySelectorResult>;
declare const getDefaultOptions: <QuerySelectorResult extends QuerySelectorReturn = Element | null>() => DefaultOptions<QuerySelectorResult>;

declare function createWaitElement<Instance_Result = unknown, Instance_QuerySelectorResult extends QuerySelectorReturn = QuerySelectorReturn>(instanceOptions: InstanceOptions<Instance_Result, Instance_QuerySelectorResult>): <Result = Instance_Result, QuerySelectorResult extends QuerySelectorReturn = Element | null>(selector: string, options?: UserSideOptions<Result, QuerySelectorResult>) => Promise<Result>;
declare const waitElement: <Result = Element, QuerySelectorResult extends QuerySelectorReturn = Element | null>(selector: string, options?: Partial<Options<Result, QuerySelectorResult>> | undefined) => Promise<Result>;

export { createWaitElement, getDefaultOptions, waitElement };
