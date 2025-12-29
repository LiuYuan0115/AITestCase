import { TemplateType } from "../plugin/template-types";
export interface MergeJsonOutputOptions {
    /**
     * List of input file paths to merge.
     */
    inputs: string[];
    /**
     * Output file name.
     *
     * @default "./stats.html"
     */
    filename?: string;
    /**
     * Output file title.
     *
     * @default "Rollup Visualizer"
     */
    title?: string;
    /**
     * Template type
     *
     * @default "treemap"
     */
    template?: TemplateType;
    /**
     * Open generated tempate in default user agent.
     *
     * @default false
     */
    open?: boolean;
}
export declare function mergeJsonOutputs(options: MergeJsonOutputOptions): Promise<void>;
