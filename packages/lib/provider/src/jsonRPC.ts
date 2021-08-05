import { SyncOrPromise } from "@renproject/interfaces";

export type JSONRPCResponse<T> =
    | {
          jsonrpc: string;
          version: string;
          result: T;
          error: undefined;
          id: number;
      }
    | {
          jsonrpc: string;
          version: string;
          result: undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: any;
          id: number;
      };

export interface Provider<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Requests extends { [event: string]: any } = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Responses extends { [event: string]: any } = {},
> {
    sendMessage<Method extends keyof Requests & string>(
        method: Method,
        request: Requests[Method],
        retry?: number,
        timeout?: number,
    ): SyncOrPromise<Responses[Method]>;
}
