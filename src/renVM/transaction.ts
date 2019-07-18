import { Token } from "../types/assets";
import { Arg } from "./jsonRPC";

// Minting/Shifting ////////////////////////////////////////////////////////////

export type TxArgsArray = [
    Arg<"phash", "b32", string>, // base64
    Arg<"amount", "u64", number>,
    Arg<"token", "b20", string>, // base64
    Arg<"to", "b20", string>, // base64
    Arg<"n", "b32", string>, // base64
    Arg<"utxo", "ext_btcCompatUTXO", { "txHash": string; /* base64 */ "vOut": number; }>
];

export type TxSignatureArray = [
    Arg<"r", "b", string>, // base 64
    Arg<"s", "b", string>, // base 64
    Arg<"v", "b", string>, // base 64
];

export interface SubmitTxRequest {
    // Tx being submitted.
    tx: {
        "to": Token;
        "args": TxArgsArray;
    };
}

export interface QueryTxRequest {
    // TxHash of the transaction that will be returned.
    txHash: string;
}

export type SubmitTxResponse = {
    // Tx being submitted.
    tx: {
        hash: string;
        to: Token;
        args: TxArgsArray;
    };
};

export enum TxStatus {
    // TxStatusNil is used for transactions that have not been seen, or are
    // otherwise unknown.
    TxStatusNil = "nil",
    // TxStatusConfirming is used for transactions that are currently waiting
    // for their underlying blockchain transactions to ne confirmed.
    TxStatusConfirming = "confirming",
    // TxStatusPending is used for transactions that are waiting for consensus
    // to be reached on when the transaction should be executed.
    TxStatusPending = "pending",
    // TxStatusExecuting is used for transactions that are currently being
    // executed.
    TxStatusExecuting = "executing",
    // TxStatusDone is used for transactions that have been successfully
    // executed.
    TxStatusDone = "done",
    // TxStatusReverted is used for transactions that were reverted during
    // execution.
    TxStatusReverted = "reverted",
}

export interface QueryTxResponse {
    tx: {
        hash: string;
        to: Token;
        args: TxArgsArray;
        out: TxSignatureArray;
    };
    txStatus: TxStatus;
}

export interface MintApproval {
    tx: {
        hash: string;
        to: Token;
        args: TxArgsArray;
        out: TxSignatureArray;
    };
    txStatus: TxStatus;
}

// export type ShiftedOutResponse = {
//     amount: number;
//     to: string;
//     ref: number;
// };

export interface Tx {
    hash: string;
    args: {
        phash: string;
        amount: number;
        token: string;
        to: string;
        n: string;
        utxo: { "txHash": string; "vOut": number; };
    };
    signature: {
        r: string;
        s: string;
        v: string;
    };
}
