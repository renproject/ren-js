import { TxStatus } from "@renproject/interfaces";

import {
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "../methods/ren_queryBlockState";
import { TypedPackValue } from "../pack/pack";
import {
    BurnTransactionInput,
    MintTransactionInput,
    SubmitGatewayInput,
} from "../transaction";
import { RenVMType, RenVMValue } from "../value";

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

    // MethodQueryState returns the contract state.
    QueryState = "ren_queryState",

    // MethodQueryBlockState returns the contract state.
    QueryBlockState = "ren_queryBlockState",
}

// Params //////////////////////////////////////////////////////////////////////

// ParamsQueryTxs defines the parameters of the MethodQueryTxs.
export interface ParamsQueryTxs {
    txStatus?: TxStatus;
    page: RenVMValue<RenVMType.U64>;
    pageSize?: RenVMValue<RenVMType.U64>;
    tags: Array<RenVMValue<RenVMType.B32>>;
}

export type ParamsSubmitGateway = {
    gateway: string;
    tx: SubmitGatewayInput;
};

// ParamsSubmitTx defines the parameters of the MethodSubmitTx.
export interface ParamsSubmitTx<
    T extends MintTransactionInput | BurnTransactionInput,
> {
    // Tx being submitted.
    tx: T;
    // Tags that should be attached to the Tx.
    // tags: Array<RenVMValue<RenVMType.B32>>;
}

export type ParamsSubmitMint = ParamsSubmitTx<MintTransactionInput>;
export type ParamsSubmitBurn = ParamsSubmitTx<BurnTransactionInput>;

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

// ParamsQueryState defines the parameters of the MethodQueryState.
export interface ParamsQueryState {
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
    txs: Array<{
        hash: string;
        to: string;
        in: TypedPackValue;
        out?: TypedPackValue;
    }>;
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
        [chain: string]: RenVMValue<RenVMType.U64>;
    };
    maxConfirmations: {
        [chain: string]: RenVMValue<RenVMType.U64>;
    };
    network: string;
    registries: {
        [chain: string]: string;
    };
    whitelist: string[];
}

// ResponseQueryState defines the response of the MethodQueryState.
export interface ResponseQueryState {
    state: {
        [chain: string]: {
            address: string; // "muMT...";
            gasCap: string; // "0";
            gasLimit: string; // "400";
            gasPrice: string; // "0";
            latestChainHash: string; // "";
            latestChainHeight: string; // "0";
            minimumAmount: string; // "547";
            pubKey: string; // "AqlA...";
        } & {
            // UTXO-based chains
            output?: {
                outpoint: {
                    hash: string; // "";
                    index: string; // "0";
                };
                pubKeyScript: string; // "";
                value: string; // "0";
            };
        } & {
            // Account-based chains
            nonce?: string;
        };
    };
}

// /////////////////////////////////////////////////////////////////////////////

export type RenVMParams = {
    [RPCMethod.SubmitTx]: ParamsSubmitBurn | ParamsSubmitMint;
    [RPCMethod.SubmitGateway]: ParamsSubmitGateway;
    [RPCMethod.QueryTx]: ParamsQueryTx;
    [RPCMethod.QueryTxs]: ParamsQueryTxs;
    [RPCMethod.QueryBlock]: ParamsQueryBlock;
    [RPCMethod.QueryBlocks]: ParamsQueryBlocks;
    [RPCMethod.QueryConfig]: ParamsQueryConfig;
    [RPCMethod.QueryState]: ParamsQueryState;
    [RPCMethod.QueryBlockState]: ParamsQueryBlockState;
};

export type RenVMResponses = {
    [RPCMethod.SubmitTx]: ResponseSubmitTx;
    [RPCMethod.SubmitGateway]: ResponseSubmitGateway;
    [RPCMethod.QueryTx]: ResponseQueryTx;
    [RPCMethod.QueryTxs]: ResponseQueryTxs;
    [RPCMethod.QueryBlock]: ResponseQueryBlock;
    [RPCMethod.QueryBlocks]: ResponseQueryBlocks;
    [RPCMethod.QueryConfig]: ResponseQueryConfig;
    [RPCMethod.QueryState]: ResponseQueryState;
    [RPCMethod.QueryBlockState]: ResponseQueryBlockState;
};

// The following lines will throw a type error if RenVMResponses or RenVMParams
// aren't defined for all RPC methods.
// type _responsesCheck = RenVMResponses[RPCMethod];
// type _paramsCheck = RenVMParams[RPCMethod];
(): RenVMParams[RPCMethod] | void => {};
(): RenVMResponses[RPCMethod] | void => {};
