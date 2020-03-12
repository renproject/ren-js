import { RenContract, RenVMArgs, TxStatus } from "@renproject/interfaces";

import {
    BurnArgsArray, MintArgsArray, TxAutogen, TxBurnReturnedInputs, TxResponseOutputs,
} from "./renVM/transaction";

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

// tslint:disable-next-line: no-any
// export const decodeArg = <Name extends string, Type extends RenVMType.ExtTypeBtcCompatUTXO, Value>(arg: Arg<Name, Type, Value>):
//     Type extends RenVMType.ExtTypeBtcCompatUTXO ? Value :
//     Type extends "u256" | "u64" | "u32" ? BigNumber :
//     Type extends "b" | "b20" | "b32" ? Buffer :
//     Value => {
//     try {
//         // ext_btcCompatUTXO
//         if (arg.type === RenVMType.ExtTypeBtcCompatUTXO) {
//             return arg.value;
//         }

//         // u32, u64, etc.
//         if (arg.type.match(/u[0-9]+/)) {
//             return new BigNumber(arg.value);
//         }

//         // b, b20, b32, etc.
//         if (arg.type.match(/b[0-9]+/)) {
//             return Ox(Buffer.from(arg.value as unknown as string, "base64"));
//         }

//         // Fallback
//         return Ox(Buffer.from(arg.value as unknown as string, "base64"));
//     } catch (error) {
//         throw new Error(`Unable to unmarshal ${arg.name} of type ${arg.type} from RenVM: ${JSON.stringify(arg.value)} - ${error}`);
//     }
// };

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

// ParamsQueryEpoch defines the parameters of the MethodQueryEpoch.
export interface ParamsQueryEpoch {
    // EpochHash of the epoch that will be returned.
    epochHash: string;
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

export type RPCResponse<Method extends RPCMethod> =
    Method extends RPCMethod.QueryBlock ? ResponseQueryBlock
    : Method extends RPCMethod.QueryBlocks ? ResponseQueryBlocks
    : Method extends RPCMethod.SubmitTx ? ResponseSubmitTx
    : Method extends RPCMethod.QueryTx ? ResponseQueryTx
    : Method extends RPCMethod.QueryNumPeers ? ResponseQueryNumPeers
    : Method extends RPCMethod.QueryPeers ? ResponseQueryPeers
    : Method extends RPCMethod.QueryEpoch ? ResponseQueryEpoch
    : Method extends RPCMethod.QueryStat ? ResponseQueryStat
    // tslint:disable-next-line: no-any
    : any;

export type RPCParams<Method extends RPCMethod> =
    Method extends RPCMethod.QueryBlock ? ParamsQueryBlock
    : Method extends RPCMethod.QueryBlocks ? ParamsQueryBlocks
    // tslint:disable-next-line: no-any
    : Method extends RPCMethod.SubmitTx ? ParamsSubmitBurn | ParamsSubmitMint
    : Method extends RPCMethod.QueryTx ? ParamsQueryTx
    : Method extends RPCMethod.QueryNumPeers ? ParamsQueryNumPeers
    : Method extends RPCMethod.QueryPeers ? ParamsQueryPeers
    : Method extends RPCMethod.QueryEpoch ? ParamsQueryEpoch
    : Method extends RPCMethod.QueryStat ? ParamsQueryStat
    // tslint:disable-next-line: no-any
    : any;
