export interface WxtWebSocket extends WebSocket {
    addWxtEventListener(type: 'wxt:reload-extension', callback: (event: CustomEvent<undefined>) => void, options?: AddEventListenerOptions | boolean): void;
    addWxtEventListener(type: 'wxt:reload-content-script', callback?: (event: CustomEvent<ReloadContentScriptPayload>) => void, options?: AddEventListenerOptions | boolean): void;
    addWxtEventListener(type: 'wxt:reload-page', callback?: (event: CustomEvent<string>) => void, options?: AddEventListenerOptions | boolean): void;
    sendCustom(event: string, payload?: any): void;
}
/**
 * Connect to the websocket and listen for messages.
 *
 * @param onMessage Optional callback that is called when a message is recieved and we've verified
 *                  it's structure is what we expect.
 */
export declare function getDevServerWebSocket(): WxtWebSocket;
export interface ReloadContentScriptPayload {
    registration?: 'manifest' | 'runtime';
    contentScript: {
        matches: string[];
        js?: string[];
        css?: string[];
    };
}
