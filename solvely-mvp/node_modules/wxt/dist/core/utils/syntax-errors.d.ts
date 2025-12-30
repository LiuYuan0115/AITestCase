export interface BabelSyntaxError extends SyntaxError {
    code: 'BABEL_PARSER_SYNTAX_ERROR';
    frame?: string;
    id: string;
    loc: {
        line: number;
        column: number;
    };
}
export declare function isBabelSyntaxError(error: unknown): error is BabelSyntaxError;
export declare function logBabelSyntaxError(error: BabelSyntaxError): void;
