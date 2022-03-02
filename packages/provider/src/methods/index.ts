import {
    ParamsQueryBlock,
    ParamsQueryBlocks,
    ResponseQueryBlock,
    ResponseQueryBlocks,
} from "./ren_queryBlock";
import {
    ParamsQueryBlockState,
    ResponseQueryBlockState,
} from "./ren_queryBlockState";
import { ParamsQueryConfig, ResponseQueryConfig } from "./ren_queryConfig";
import { ParamsSubmitGateway } from "./ren_submitGateway";
import {
    ParamsQueryTx,
    ParamsQueryTxs,
    ParamsSubmitTx,
    ResponseQueryTx,
    ResponseQueryTxs,
    ResponseSubmitGateway,
    ResponseSubmitTx,
} from "./ren_submitTx";

export * from "./ren_queryBlock";
export * from "./ren_queryBlockState";
export * from "./ren_queryConfig";
export * from "./ren_submitGateway";
export * from "./ren_submitTx";

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
