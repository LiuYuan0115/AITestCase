import { JSItem, CSSItem } from './types';
export declare function escapeHtml(html: string): string;
export declare function escapeScript(content: string): string;
export declare function htmlOpen(tagName: string, attrs?: Record<string, string | boolean>): string;
export declare function htmlClose(tagName: string): string;
export declare function wrapHtml(tagName: string, content?: string | null, attrs?: Record<string, string | boolean>): string;
export declare function buildCode<T extends unknown[]>(fn: (...args: T) => void, args: T): string;
export declare function persistJS(items: JSItem[], context?: unknown): string[];
export declare function persistCSS(items: CSSItem[]): string[];
