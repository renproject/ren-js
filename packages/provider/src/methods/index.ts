import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TxStatus,
    TypedPackValue,
} from "@renproject/utils";

import {
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "./ren_queryBlockState";

export * from "./ren_queryBlockState";

export enum RPCMethod {
    // MethodSubmitGateway submits the details of a gateway to the lightnode,
    // used for recovering mints that didn't get submitted to RenVM.
    SubmitGateway = "ren_submitGateway",

    // MethodSubmitTx submits a new transaction to the Darknode for acceptance
    // into the transaction pool.
    SubmitTx = "ren_submitTx",

    // MethodQueryTx returns the latest information about a transaction
    // identified by a transaction hash.
    QueryTx = "ren_queryTx",

    // MethodQueryTxs returns pages of transactions with optional filtering by
    // status and tags.
    QueryTxs = "ren_queryTxs",

    // MethodQueryBlock returns a block identified by the block height.
    QueryBlock = "ren_queryBlock",

    // MethodQueryBlocks returns recently committed blocks.
    QueryBlocks = "ren_queryBlocks",

    // MethodQueryConfig returns the node configuration.
    QueryConfig = "ren_queryConfig",

    // MethodQueryBlockState returns the contract state.
    QueryBlockState = "ren_queryBlockState",
}

// Params //////////////////////////////////////////////////////////////////////

export interface TransactionInput<
    Input extends TypedPackValue = TypedPackValue,
> {
    hash: string;
    version: string;
    selector: string;
    in: Input;
}

export interface TransactionOutput<
    Input extends TypedPackValue,
    Output extends TypedPackValue,
> extends TransactionInput<Input> {
    out: Output;
}

export interface RPCValue<Types extends PackTypeDefinition, Values> {
    t: Types;
    v: Values;
}

export type EmptyRPCStruct = RPCValue<{ struct: [] }, {}>;

export const burnParamsType: PackTypeDefinition = {
    struct: [
        {
            amount: PackPrimitive.U256,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
    ],
};

export const crossChainParamsType: PackTypeDefinition = {
    struct: [
        {
            txid: PackPrimitive.Bytes,
        },
        {
            txindex: PackPrimitive.U32,
        },
        {
            amount: PackPrimitive.U256,
        },
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export type CrossChainParams = RPCValue<
    // Types
    typeof crossChainParamsType,
    // Values
    {
        amount: Marshalled<PackPrimitive.U256>;
        ghash: Marshalled<PackPrimitive.Bytes32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: Marshalled<PackPrimitive.Bytes>; // "8Qnq",
        nhash: Marshalled<PackPrimitive.Bytes32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: Marshalled<PackPrimitive.Bytes32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: Marshalled<PackPrimitive.Bytes>; // "I_9MVtYiO4NlH7lwIx8",
        phash: Marshalled<PackPrimitive.Bytes32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: Marshalled<PackPrimitive.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        txid: Marshalled<PackPrimitive.Bytes>;
        txindex: Marshalled<PackPrimitive.U32>;
    }
>;

export const submitGatewayType: PackTypeDefinition = {
    struct: [
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export type SubmitGateway = RPCValue<
    // Types
    typeof submitGatewayType,
    // Values
    {
        amount: Marshalled<PackPrimitive.U256>;
        ghash: Marshalled<PackPrimitive.Bytes32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: Marshalled<PackPrimitive.Bytes>; // "8Qnq",
        nhash: Marshalled<PackPrimitive.Bytes32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: Marshalled<PackPrimitive.Bytes32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: Marshalled<PackPrimitive.Bytes>; // "I_9MVtYiO4NlH7lwIx8",
        phash: Marshalled<PackPrimitive.Bytes32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: Marshalled<PackPrimitive.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        txid: Marshalled<PackPrimitive.Bytes>;
        txindex: Marshalled<PackPrimitive.U32>;
    }
>;

export interface SubmitGatewayInput {
    version: string;
    selector: string;
    in: SubmitGateway;
}

// ParamsQueryTxs defines the parameters of the MethodQueryTxs.
export interface ParamsQueryTxs {
    txStatus?: TxStatus;
    page: Marshalled<PackPrimitive.U64>;
    pageSize?: Marshalled<PackPrimitive.U64>;
    tags: Array<Marshalled<PackPrimitive.Bytes32>>;
}

export type ParamsSubmitGateway = {
    gateway: string;
    tx: SubmitGatewayInput;
};

// ParamsSubmitTx defines the parameters of the MethodSubmitTx.
export interface ParamsSubmitTx<T extends TransactionInput = TransactionInput> {
    // Tx being submitted.
    tx: T;
    // Tags that should be attached to the Tx.
    // tags: Array<Marshalled<PackPrimitive.Bytes32>>;
}

// ParamsQueryTx defines the parameters of the MethodQueryTx.
export interface ParamsQueryTx {
    // TxHash of the transaction that will be returned.
    txHash: string;
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

// ParamsQueryConfig defines the parameters of the MethodQueryConfig.
export interface ParamsQueryConfig {
    // No parameters.
}

// Responses ///////////////////////////////////////////////////////////////////

// ResponseSubmitTx defines the response of the MethodSubmitTx.
export interface ResponseSubmitTx {}

// ResponseSubmitTx defines the response of the MethodSubmitTx.
export interface ResponseSubmitTx {
    // Tx after transformation by the Darknode.
    // Tx abi.Tx`json:"tx"`
    tx: {
        hash: string;
        to: string;
        in: TypedPackValue;
    };
}

// ResponseSubmitGateway defines the response of the MethodSubmitGateway.
export interface ResponseSubmitGateway {}

// ResponseQueryTx defines the response of the MethodQueryTx.
export interface ResponseQueryTx<
    Input extends TypedPackValue = TypedPackValue,
    Output extends TypedPackValue = TypedPackValue,
> {
    // Tx       abi.Tx`json:"tx"`
    tx: {
        version: "0" | "1";
        hash: string;
        selector: string;
        in: Input;
        out: Output;
    };
    // TxStatus string`json:"txStatus"`
    txStatus: TxStatus;
}

// ResponseQueryTxs defines the response of the MethodQueryTxs.
export interface ResponseQueryTxs {
    txs: Array<ResponseQueryTx["tx"]>;
}

// ResponseQueryBlock defines the response of the MethodQueryBlock.
export interface ResponseQueryBlock {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    block: any; // Block json.RawMessage`json:"block"`
}

// ResponseQueryBlocks defines the response of the MethodQueryBlocks.
export interface ResponseQueryBlocks {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks: any; // Blocks json.RawMessage`json:"blocks"`
}

// ResponseQueryConfig defines the response of the MethodQueryConfig.
export interface ResponseQueryConfig {
    confirmations: {
        [chain: string]: Marshalled<PackPrimitive.U64>;
    };
    maxConfirmations: {
        [chain: string]: Marshalled<PackPrimitive.U64>;
    };
    network: string;
    registries: {
        [chain: string]: string;
    };
    whitelist: string[];
}

// /////////////////////////////////////////////////////////////////////////////

export type RPCParams = {
    [RPCMethod.SubmitTx]: ParamsSubmitTx;
    [RPCMethod.SubmitGateway]: ParamsSubmitGateway;
    [RPCMethod.QueryTx]: ParamsQueryTx;
    [RPCMethod.QueryTxs]: ParamsQueryTxs;
    [RPCMethod.QueryBlock]: ParamsQueryBlock;
    [RPCMethod.QueryBlocks]: ParamsQueryBlocks;
    [RPCMethod.QueryConfig]: ParamsQueryConfig;
    [RPCMethod.QueryBlockState]: ParamsQueryBlockState;
};

export type RPCResponses = {
    [RPCMethod.SubmitTx]: ResponseSubmitTx;
    [RPCMethod.SubmitGateway]: ResponseSubmitGateway;
    [RPCMethod.QueryTx]: ResponseQueryTx;
    [RPCMethod.QueryTxs]: ResponseQueryTxs;
    [RPCMethod.QueryBlock]: ResponseQueryBlock;
    [RPCMethod.QueryBlocks]: ResponseQueryBlocks;
    [RPCMethod.QueryConfig]: ResponseQueryConfig;
    [RPCMethod.QueryBlockState]: ResponseQueryBlockState;
};

// The following lines will throw a type error if RenVMResponses or RenVMParams
// aren't defined for all RPC methods.
(): RPCParams[RPCMethod] | void => {};
(): RPCResponses[RPCMethod] | void => {};
