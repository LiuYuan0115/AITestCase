import { UrlBuilder } from 'markmap-common';
import { IHtmlParserOptions } from 'markmap-html-parser';
import { Remarkable } from 'remarkable';
import { IAssets, IFeatures, ITransformHooks, ITransformPlugin, ITransformResult, ITransformer } from './types';
export declare const builtInPlugins: ITransformPlugin[];
export declare class Transformer implements ITransformer {
    hooks: ITransformHooks;
    md: Remarkable;
    assetsMap: Record<string, IAssets>;
    urlBuilder: UrlBuilder;
    plugins: ITransformPlugin[];
    constructor(plugins?: Array<ITransformPlugin | (() => ITransformPlugin)>);
    transform(content: string, opts?: Partial<IHtmlParserOptions>): ITransformResult;
    /**
     * Get all assets from enabled plugins or filter them by plugin names as keys.
     */
    getAssets(keys?: string[]): IAssets;
    /**
     * Get used assets by features object returned by `transform`.
     */
    getUsedAssets(features: IFeatures): IAssets;
}
