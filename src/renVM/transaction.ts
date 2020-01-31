import { Arg } from "@renproject/ren-js-common";

// Minting/Shifting ////////////////////////////////////////////////////////////

export type MintArgsArray = [
    Arg<"phash", "b32", string>, // base64
    // Arg<"amount", "u64", number>,
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
    // Arg<"amount", "u64", number>,
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
