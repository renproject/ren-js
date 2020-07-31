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
          // tslint:disable-next-line: no-any
          error: any;
          id: number;
      };

// tslint:disable-next-line: no-any
export interface Provider<
    Requests extends { [event: string]: any } = {},
    Responses extends { [event: string]: any } = {}
> {
    sendMessage<Method extends keyof Requests>(
        method: Method,
        request: Requests[Method],
        retry?: number
    ): Promise<Method extends keyof Responses ? Responses[Method] : {}>;
}
