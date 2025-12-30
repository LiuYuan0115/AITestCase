import { VType, VTYPE_ELEMENT, VTYPE_FUNCTION } from './consts';
export type VProps = {
    ref?: (el: Node) => void;
    innerHTML?: string;
    innerText?: string;
    textContent?: string;
    dangerouslySetInnerHTML?: {
        __html: string;
    };
    children?: VChildren;
} & {
    [key: string]: string | boolean | ((...args: unknown[]) => unknown);
};
export type VFunction = (props: VProps) => VNode;
export interface VNode {
    vtype: VType;
    type: string | VFunction;
    props: VProps;
}
export interface VElementNode extends VNode {
    vtype: typeof VTYPE_ELEMENT;
    type: string;
}
export interface VFunctionNode extends VNode {
    vtype: typeof VTYPE_FUNCTION;
    type: VFunction;
}
export type VChild = string | number | boolean | null | Node | VNode;
export type VChildren = VChild | VChildren[];
export interface MountEnv {
    isSvg: boolean;
}
export type DomNode = Node;
export type DomResult = DomNode | DomResult[];
