import { Ox } from "../lib/utils";

export enum RPCMethod {
    // QueryBlock returns a block identified by the block height.
    QueryBlock = "ren_queryBlock",
    // QueryBlocks returns recently committed blocks.
    QueryBlocks = "ren_queryBlocks",

    // SubmitTx submits a new transaction to the Darknode for acceptance
    // into the transaction pool.
    SubmitTx = "ren_submitTx",
    // QueryTx returns the latest information about a transaction
    // identified by a transaction hash.
    QueryTx = "ren_queryTx",

    // QueryNumPeers returns the number of known peers.
    QueryNumPeers = "ren_queryNumPeers",
    // QueryPeers returns a random subset of known peers.
    QueryPeers = "ren_queryPeers",

    // QueryEpoch returns an epoch identified by an epoch hash.
    QueryEpoch = "ren_queryEpoch",

    // QueryStat returns status information about the Darknode. This
    // information cannot be verified.
    QueryStat = "ren_queryStat",
}

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

export interface Arg<name extends string, type extends string, valueType> {
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type Args = Array<Arg<string, string, any>>;

// tslint:disable-next-line: no-any
export const decodeValue = <Name extends string, Type extends string, Value>(value: Arg<Name, Type, Value>) => {
    try {
        // ext_btcCompatUTXO
        if (value.type === "ext_btcCompatUTXO" || value.type === "ext_zecCompatUTXO") {
            return value.value;
        }

        // u32, u64, etc.
        if (value.type.match(/u[0-9]+/)) {
            return value.value;
        }

        // b, b20, b32, etc.
        if (value.type.match(/b[0-9]+/)) {
            return Ox(Buffer.from(value.value as unknown as string, "base64"));
        }

        // Fallback
        return Ox(Buffer.from(value.value as unknown as string, "base64"));
    } catch (error) {
        throw new Error(`Unable to unmarshal ${value.name} of type ${value.type} from RenVM: ${JSON.stringify(value.value)} - ${error}`);
    }
};

export interface QueryStat {
    version: string;
    multiAddress: string;
    cpus: Array<{
        cores: number;
        clockRate: number;
        cacheSize: number;
        modelName: string;
    }>;
    memory: number;
    memoryUsed: number;
    memoryFree: number;
    disk: number;
    diskUsed: number;
    diskFree: number;
    systemUptime: number;
    serviceUptime: number;
}

export interface QueryPeers {
    peers: string[];
}
