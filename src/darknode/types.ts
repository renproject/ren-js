
export interface Arg {
    name: string;
    type: string;
    value: string | number;
}

export type Args = Arg[];

/// Requests ///////////////////////////////////////////////////////////////////

export interface AddressesRequest {
    darknodeIDs: string[];
}

export interface SendMessageRequest {
    to: string;
    args: Args;
}

export interface ReceiveMessageRequest {
    messageID: string;
}

/// Responses //////////////////////////////////////////////////////////////////

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

export type HealthResponse = JSONRPCResponse<{
    version: string;
    address: string;
    cpus: {
        cores: number;
        clockRate: number;
        cacheSize: number;
        modelName: string;
    };
    ram: string;
    disk: string;
    location: string;
}>;

export type PeersResponse = JSONRPCResponse<{
    peers: string[];
}>;

export type NumPeersResponse = JSONRPCResponse<{
    numPeers: number;
}>;

export type EpochResponse = JSONRPCResponse<{
    epochHash: string;
    shardHashes: string[];
}>;

export type AddressesResponse = JSONRPCResponse<{
    addresses: string[];
}>;

export type SendMessageResponse = JSONRPCResponse<{
    messageID: string;
    ok: boolean;
}>;

export type ReceiveMessageResponse = JSONRPCResponse<{
    result: Args;
}>;

// type RenVMReceiveMessageResponse = JSONRPCResponse<{
//     values: [PublicParam];
// }>;
