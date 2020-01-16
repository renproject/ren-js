import { Arg } from "./arg";

// Minting/Shifting ////////////////////////////////////////////////////////////

export type MintArgsArray = [
    Arg<"phash", "b32", string>, // base64
    Arg<"amount", "u64", number>,
    Arg<"token", "b20", string>, // base64
    Arg<"to", "b20", string>, // base64
    Arg<"n", "b32", string>, // base64
    Arg<"utxo", "ext_btcCompatUTXO" | "ext_zecCompatUTXO", { "txHash": string; /* base64 */ "vOut": number; }>
];

export type BurnArgsArray = [
    Arg<"ref", "u64", number>,
];

export type TxOutputArgsArray = [
    Arg<"phash", "b32", string>,
    Arg<"amount", "u64", number>,
    Arg<"token", "b20", string>,
    Arg<"to", "b20", string>,
    Arg<"n", "b32", string>,
    Arg<"utxo", "ext_btcCompatUTXO" | "ext_zecCompatUTXO", { "txHash": string, "vOut": number, "scriptPubKey": string, "amount": 60000 }>,
    Arg<"gas", "u64", number>,
    Arg<"ghash", "b32", string>,
    Arg<"nhash", "b32", string>,
    Arg<"hash", "b32", string>,
];

export type TxSignatureArray = [
    Arg<"r", "b", string>, // base 64
    Arg<"s", "b", string>, // base 64
    Arg<"v", "b", string>, // base 64
];

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

export interface Tx {
    hash: string;
    args: {
        phash: string;
        amount: number;
        token: string;
        to: string;
        n: string;
        utxo: { "txHash": string, "vOut": number, "scriptPubKey": string, "amount": number, ghash: string };
        // gas: number;
        ghash: string;
        nhash: string;
        hash: string;
    };
    signature: {
        r: string;
        s: string;
        v: string;
    };
}
