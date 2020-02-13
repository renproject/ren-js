import { RenContract } from "./renVM";
import { TxStatus } from "./types";

export interface UnmarshalledMintTx {
    hash: string; // Buffer;
    txStatus: TxStatus;
    to: RenContract;
    in: {
        phash: string; // Buffer;
        token: string;
        to: string;
        n: string; // Buffer;
        utxo: { "txHash": string, "vOut": number, "scriptPubKey": string, "amount": string };
        amount: string;
    };
    autogen: {
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
    to: RenContract;
    in: {
        ref: string;
        to: string; // Buffer;
        amount: string;
    };
}

export type UnmarshalledTx = UnmarshalledMintTx | UnmarshalledBurnTx;
