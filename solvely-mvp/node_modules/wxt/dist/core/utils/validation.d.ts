import { Entrypoint } from '../../types';
export declare function validateEntrypoints(entrypoints: Entrypoint[]): ValidationResults;
export interface ValidationResult {
    type: 'warning' | 'error';
    message: string;
    entrypoint: Entrypoint;
    value: any;
}
export interface ValidationResults {
    errors: ValidationResult[];
    errorCount: number;
    warningCount: number;
}
export declare class ValidationError extends Error {
}
