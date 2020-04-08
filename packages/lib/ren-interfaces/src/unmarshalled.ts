import { AbiItem } from "./abi";
import { RenContract } from "./renVM";
import { TxStatus } from "./types";

export interface UnmarshalledMintTx {
    hash: string; // Buffer;
    txStatus: TxStatus;
    to: RenContract;
    in: {
        p: {
            abi: AbiItem[],
            value: string,
            fn: string,
        };
        token: string;
        to: string;
        n: string; // Buffer;
        utxo: { "txHash": string, "vOut": number, "scriptPubKey": string, "amount": string };
    };
    autogen: {
        phash: string; // Buffer;
        amount: string;
        ghash: string; // Buffer;
        nhash: string; // Buffer;
        sighash: string; // Buffer;
    };
    out?: {
        r: string;
        s: string;
        v: string;
    };
}

export interface UnmarshalledBurnTx {
    hash: string; // Buffer;
    txStatus: TxStatus;
    to: RenContract;
    in: {
        ref: string;
        to: string; // Buffer;
        amount: string;
    };
}

export type UnmarshalledTx = UnmarshalledMintTx | UnmarshalledBurnTx;
