interface HasQuerySelector {
    querySelector: Document["querySelector"];
}
interface NodeLike extends HasQuerySelector, Node {
    [otherKey: string]: any;
}
type QuerySelectorReturn = ReturnType<HasQuerySelector["querySelector"]>;
type DefaultResult = Element;

type DetectorResultType<Result> = {
    isDetected: true;
    result: Result;
} | {
    isDetected: false;
};
type Detector<Result = unknown, QuerySelectorResult extends QuerySelectorReturn = QuerySelectorReturn> = (element: QuerySelectorResult) => DetectorResultType<Result> | Promise<DetectorResultType<Result>>;
declare const isExist: Detector<Element>;
declare const isNotExist: Detector<null>;

export { type Detector as D, type NodeLike as N, type QuerySelectorReturn as Q, type DefaultResult as a, type DetectorResultType as b, isNotExist as c, isExist as i };
