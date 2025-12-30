import type * as d3 from 'd3';
import { FlextreeNode } from 'd3-flextree';
import { Hook, IMarkmapOptions, INode, IPureNode } from 'markmap-common';
import { IMarkmapState, IPadding, ID3SVGElement } from './types';
export declare const globalCSS: string;
/**
 * A global hook to refresh all markmaps when called.
 */
export declare const refreshHook: Hook<[]>;
export declare class Markmap {
    options: IMarkmapOptions;
    state: IMarkmapState;
    svg: ID3SVGElement;
    styleNode: d3.Selection<HTMLStyleElement, FlextreeNode<INode>, HTMLElement, FlextreeNode<INode>>;
    g: d3.Selection<SVGGElement, FlextreeNode<INode>, HTMLElement, FlextreeNode<INode>>;
    zoom: d3.ZoomBehavior<SVGElement, FlextreeNode<INode>>;
    revokers: (() => void)[];
    private imgCache;
    private debouncedRefresh;
    constructor(svg: string | SVGElement | ID3SVGElement, opts?: Partial<IMarkmapOptions>);
    getStyleContent(): string;
    updateStyle(): void;
    handleZoom: (e: any) => void;
    handlePan: (e: WheelEvent) => void;
    toggleNode(data: INode, recursive?: boolean): void;
    handleClick: (e: MouseEvent, d: FlextreeNode<INode>) => void;
    initializeData(node: INode): void;
    private _checkImages;
    private _loadImage;
    setOptions(opts?: Partial<IMarkmapOptions>): void;
    setData(data?: IPureNode | null, opts?: Partial<IMarkmapOptions>): void;
    renderData(originData?: INode): void;
    transition<T extends d3.BaseType, U, P extends d3.BaseType, Q>(sel: d3.Selection<T, U, P, Q>): d3.Transition<T, U, P, Q>;
    /**
     * Fit the content to the viewport.
     */
    fit(): Promise<void>;
    findElement(node: INode): {
        data: FlextreeNode<INode>;
        g: SVGGElement;
    } | undefined;
    /**
     * Pan the content to make the provided node visible in the viewport.
     */
    ensureView(node: INode, padding: Partial<IPadding> | undefined): Promise<void>;
    /**
     * Scale content with it pinned at the center of the viewport.
     */
    rescale(scale: number): Promise<void>;
    destroy(): void;
    static create(svg: string | SVGElement | ID3SVGElement, opts?: Partial<IMarkmapOptions>, data?: IPureNode | null): Markmap;
}
