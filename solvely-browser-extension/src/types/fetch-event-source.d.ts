declare module '@sentool/fetch-event-source' {
  export interface FetchEventSourceInit extends RequestInit {
    onopen?: (response: Response) => void;
    onmessage?: (event: { id?: string; event?: string; data: string }) => void;
    onclose?: (event: unknown) => void;
    onerror?: (error: Error) => void;
    done?: (event: unknown) => void;
  }

  export function fetchEventSource(
    input: RequestInfo,
    init: FetchEventSourceInit
  ): Promise<void>;
} 