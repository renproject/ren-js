import { RenContract, RenVMArgs, Shard, TxStatus } from "@renproject/interfaces";

import {
    BurnArgsArray, MintArgsArray, TxAutogen, TxBurnReturnedInputs, TxResponseOutputs,
} from "./transaction";

export enum RPCMethod {
    // MethodSubmitTx submits a new transaction to the Darknode for acceptance
    // into the transaction pool.
    MethodSubmitTx = "ren_submitTx",
    // MethodQueryTx returns the latest information about a transaction
    // identified by a transaction hash.
    MethodQueryTx = "ren_queryTx",

    // MethodQueryBlock returns a block identified by the block height.
    MethodQueryBlock = "ren_queryBlock",
    // MethodQueryBlocks returns recently committed blocks.
    MethodQueryBlocks = "ren_queryBlocks",

    // MethodQueryNumPeers returns the number of known peers.
    MethodQueryNumPeers = "ren_queryNumPeers",
    // MethodQueryPeers returns a random subset of known peers.
    MethodQueryPeers = "ren_queryPeers",

    // MethodQueryShards returns information about the currently online/offline
    // Shards.
    MethodQueryShards = "ren_queryShards",

    // MethodQueryStat returns status information about the Darknode. This
    // information cannot be verified.
    MethodQueryStat = "ren_queryStat",
}

// ParamsQueryBlock defines the parameters of the MethodQueryBlock.
export interface ParamsQueryBlock {
    // BlockHeight of the block that will be returned. A nil value can be used
    // to request the latest block.
    blockHeight: number;
}

// ParamsQueryBlocks defines the parameters of the MethodQueryBlocks.
export interface ParamsQueryBlocks {
    // BlockHeight of the youngest block that will be returned in the list. A
    // nil value can be used to request a list of the latest blocks.
    blockHeight: number;
    // N defines the maximum number of ancestor blocks that will be returned. A
    // nil value can be used to request the maximum allowed number of blocks.
    n: number;
}

// ParamsSubmitTx defines the parameters of the MethodSubmitTx.
interface ParamsSubmitTx<T extends RenVMArgs> {
    // Tx being submitted.
    tx: {
        to: RenContract;
        in: T;
    };
}

export type ParamsSubmitMint = ParamsSubmitTx<MintArgsArray>;
export type ParamsSubmitBurn = ParamsSubmitTx<BurnArgsArray>;

// ParamsQueryTx defines the parameters of the MethodQueryTx.
export interface ParamsQueryTx {
    // TxHash of the transaction that will be returned.
    txHash: string;
}

// ParamsQueryNumPeers defines the parameters of the MethodQueryNumPeers.
export interface ParamsQueryNumPeers {
    // No parameters.
}

// ParamsQueryPeers defines the parameters of the MethodQueryPeers.
export interface ParamsQueryPeers {
    // No parameters.
}

// ParamsQueryShards defines the parameters of the MethodQueryShards.
export interface ParamsQueryShards {
    // No parameters.
}

// ParamsQueryStat defines the parameters of the MethodQueryStat.
export interface ParamsQueryStat {
    // No parameters.
}

// ResponseQueryBlock defines the response of the MethodQueryBlock.
export interface ResponseQueryBlock {
    // tslint:disable-next-line: no-any
    block: any; // Block json.RawMessage`json:"block"`
}

// ResponseQueryBlocks defines the response of the MethodQueryBlocks.
export interface ResponseQueryBlocks {
    // tslint:disable-next-line: no-any
    blocks: any; // Blocks json.RawMessage`json:"blocks"`
}

// ResponseSubmitTx defines the response of the MethodSubmitTx.
export interface ResponseSubmitTx {
    // Tx after transformation by the Darknode.
    // Tx abi.Tx`json:"tx"`
    tx: {
        hash: string;
        to: RenContract;
        args: MintArgsArray;
    };
}

// ResponseQueryTx defines the response of the MethodQueryTx.

export interface ResponseQueryTx {
    // Tx       abi.Tx`json:"tx"`
    tx: {
        hash: string;
        to: RenContract;
        in: RenVMArgs;
        autogen?: RenVMArgs;
        out?: RenVMArgs;
    };
    // TxStatus string`json:"txStatus"`
    txStatus: TxStatus;
}

export interface ResponseQueryMintTx extends ResponseQueryTx {
    // Tx       abi.Tx`json:"tx"`
    tx: {
        hash: string;
        to: RenContract;
        in: MintArgsArray;
        autogen: TxAutogen;
        out?: TxResponseOutputs;
    };
    // TxStatus string`json:"txStatus"`
    txStatus: TxStatus;
}

export interface ResponseQueryBurnTx extends ResponseQueryTx {
    // Tx       abi.Tx`json:"tx"`
    tx: {
        hash: string;
        to: RenContract;
        in: TxBurnReturnedInputs;
    };
    // TxStatus string`json:"txStatus"`
    txStatus: TxStatus;
}

// ResponseQueryNumPeers defines the response of the MethodQueryNumPeers.
export interface ResponseQueryNumPeers {
    numPeers: number; // NumPeers int`json:"numPeers"`
}

// ResponseQueryPeers defines the response of the MethodQueryPeers.
export interface ResponseQueryPeers {
    peers: string[]; // Peers[]string`json:"peers"`
}

// ResponseQueryShards defines the response of the MethodQueryShards.
export interface ResponseQueryShards {
    shards: Shard[];
}

// ResponseQueryEpoch defines the response of the MethodQueryEpoch.
export interface ResponseQueryEpoch {
    // TODO: Define response.
}

// ResponseQueryStat defines the response of the MethodQueryStat.
export interface ResponseQueryStat {
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

export type RenVMResponses = {
    [RPCMethod.MethodQueryBlock]: ResponseQueryBlock;
    [RPCMethod.MethodQueryBlocks]: ResponseQueryBlocks;
    [RPCMethod.MethodSubmitTx]: ResponseSubmitTx;
    [RPCMethod.MethodQueryTx]: ResponseQueryTx;
    [RPCMethod.MethodQueryNumPeers]: ResponseQueryNumPeers;
    [RPCMethod.MethodQueryPeers]: ResponseQueryPeers;
    [RPCMethod.MethodQueryShards]: ResponseQueryShards;
    [RPCMethod.MethodQueryStat]: ResponseQueryStat;
};

export type RPCResponse<Method extends RPCMethod> =
    Method extends RPCMethod.MethodQueryBlock ? ResponseQueryBlock
    : Method extends RPCMethod.MethodQueryBlocks ? ResponseQueryBlocks
    : Method extends RPCMethod.MethodSubmitTx ? ResponseSubmitTx
    : Method extends RPCMethod.MethodQueryTx ? ResponseQueryTx
    : Method extends RPCMethod.MethodQueryNumPeers ? ResponseQueryNumPeers
    : Method extends RPCMethod.MethodQueryPeers ? ResponseQueryPeers
    : Method extends RPCMethod.MethodQueryShards ? ResponseQueryShards
    : Method extends RPCMethod.MethodQueryStat ? ResponseQueryStat
    // tslint:disable-next-line: no-any
    : any;

export type RenVMParams = {
    [RPCMethod.MethodQueryBlock]: ParamsQueryBlock;
    [RPCMethod.MethodQueryBlocks]: ParamsQueryBlocks;
    [RPCMethod.MethodSubmitTx]: ParamsSubmitBurn | ParamsSubmitMint;
    [RPCMethod.MethodQueryTx]: ParamsQueryTx;
    [RPCMethod.MethodQueryNumPeers]: ParamsQueryNumPeers;
    [RPCMethod.MethodQueryPeers]: ParamsQueryPeers;
    [RPCMethod.MethodQueryShards]: ParamsQueryShards;
    [RPCMethod.MethodQueryStat]: ParamsQueryStat;
};

export type RPCParams<Method extends RPCMethod> =
    Method extends RPCMethod.MethodQueryBlock ? ParamsQueryBlock
    : Method extends RPCMethod.MethodQueryBlocks ? ParamsQueryBlocks
    // tslint:disable-next-line: no-any
    : Method extends RPCMethod.MethodSubmitTx ? ParamsSubmitBurn | ParamsSubmitMint
    : Method extends RPCMethod.MethodQueryTx ? ParamsQueryTx
    : Method extends RPCMethod.MethodQueryNumPeers ? ParamsQueryNumPeers
    : Method extends RPCMethod.MethodQueryPeers ? ParamsQueryPeers
    : Method extends RPCMethod.MethodQueryShards ? ParamsQueryShards
    : Method extends RPCMethod.MethodQueryStat ? ParamsQueryStat
    // tslint:disable-next-line: no-any
    : any;
