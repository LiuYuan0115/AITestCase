import { VProps, VFunction, VChildren, VNode } from './types';
export declare const EMPTY_OBJECT: {};
export declare const isLeaf: (c: VChildren) => boolean;
export declare const isElement: (c: VChildren) => boolean;
export declare const isRenderFunction: (c: VChildren) => boolean;
export declare function h(type: string | VFunction, props: VProps, ...children: VChildren[]): VNode;
export declare function jsx(type: string | VFunction, props: VProps): VNode;
export declare const jsxs: typeof jsx;
export declare function Fragment(props: VProps): VChildren;
