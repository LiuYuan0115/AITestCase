import { Plugin } from 'vite';
import { ResolvedConfig } from '../../../../types';
/**
 * Downloads any URL imports, like Google Analytics, into virtual modules so they are bundled with
 * the extension instead of depending on remote code at runtime.
 *
 * @example
 * import "url:https://google-tagmanager.com/gtag?id=XYZ";
 */
export declare function download(config: ResolvedConfig): Plugin;
