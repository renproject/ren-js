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

export interface Provider<
    // tslint:disable-next-line: no-any
    Requests extends { [event: string]: any } = {},
    // tslint:disable-next-line: no-any
    Responses extends { [event: string]: any } = {}
> {
    sendMessage<Method extends keyof Requests & string>(
        method: Method,
        request: Requests[Method],
        retry?: number,
    ): Promise<Responses[Method]>;
}
