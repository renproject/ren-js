
export type JSONRPCResponse<T> = {
    jsonrpc: string;
    version: string;
    result: T;
    error: undefined;
    id: number;
} | {
    jsonrpc: string;
    version: string;
    result: undefined;
    // tslint:disable-next-line: no-any
    error: any;
    id: number;
};
