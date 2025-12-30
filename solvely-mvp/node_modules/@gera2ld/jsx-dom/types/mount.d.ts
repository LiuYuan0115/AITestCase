import { h } from './h';
import { VChild, VProps, MountEnv } from './types';
export declare function insertDom(parent: HTMLElement | SVGElement | DocumentFragment, nodes: Node | Node[]): void;
export declare function mountAttributes(domElement: HTMLElement | SVGElement, props: VProps, env: MountEnv): void;
export declare function mount(vnode: VChild, env?: MountEnv): Node;
/**
 * Mount vdom as real DOM nodes.
 */
export declare function mountDom(vnode: VChild): Node;
/**
 * Render and mount without returning VirtualDOM, useful when you don't need SVG support.
 */
export declare function hm(...args: Parameters<typeof h>): Node;
