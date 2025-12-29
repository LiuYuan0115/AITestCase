import { VChildren } from '@gera2ld/jsx-dom';
import type { Markmap } from 'markmap-view';
import './style.css';
export interface IToolbarItem {
    id?: string;
    title?: string;
    content: VChildren;
    onClick?: (e: Event) => void;
}
export declare class Toolbar {
    private showBrand;
    private registry;
    private markmap;
    static defaultItems: (string | IToolbarItem)[];
    el: HTMLDivElement;
    items: (string | IToolbarItem)[];
    static create(mm: Markmap): Toolbar;
    static icon(path: string, attrs?: {}): import("@gera2ld/jsx-dom").VNode;
    constructor();
    setBrand(show: boolean): HTMLDivElement;
    register(data: IToolbarItem & {
        id: string;
    }): void;
    getHandler(handle: (mm: Markmap) => Promise<void>): () => void;
    setItems(items: (string | IToolbarItem)[]): HTMLDivElement;
    attach(mm: Markmap): void;
    render(): HTMLDivElement;
}
