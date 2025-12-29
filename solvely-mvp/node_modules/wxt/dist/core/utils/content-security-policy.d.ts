/**
 * Directive names that make up CSPs. There are more, this is all I need for the plugin.
 */
export type CspDirective = 'default-src' | 'script-src' | 'object-src';
export declare class ContentSecurityPolicy {
    private static DIRECTIVE_ORDER;
    data: Record<string, string[]>;
    constructor(csp?: string);
    /**
     * Ensure a set of values are listed under a directive.
     */
    add(directive: CspDirective, ...newValues: string[]): ContentSecurityPolicy;
    toString(): string;
}
