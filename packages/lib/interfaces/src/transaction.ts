import { AbiItem } from "./abi";
import { RenContract } from "./networks";
import { TxStatus } from "./types";

export interface RenTransaction<Input, Output> {
    hash: string; // Buffer;
    txStatus: TxStatus;
    to: RenContract;
    in: Input;
    out?: Output;
}

export type MintTransaction = RenTransaction<
    // Input
    {
        p: {
            abi: AbiItem[];
            value: string;
            fn: string;
        };
        token: string;
        to: string;
        n: string; // Buffer;
        utxo: {
            txHash: string;
            vOut: number;
            scriptPubKey: string;
            amount: string;
        };
    },
    // Output
    {
        phash: string; // Buffer;
        amount: string;
        ghash: string; // Buffer;
        nhash: string; // Buffer;
        sighash: string; // Buffer;
        signature?: Buffer;
    }
>;

export type BurnTransaction = RenTransaction<
    // Input
    {
        ref: string;
        to: string; // Buffer;
        amount: string;
    },
    // Output
    {}
>;

export type RenVMAssetFees = {
    [mintChain: string]: {
        mint: number; // Minting fee basis points (10 = 0.1%)
        burn: number; // Burning fee basis points (10 = 0.1%)
    };
} & {
    lock: number; // Chain transaction fees for locking (in sats)
    release: number; // Chain transaction fees for releasing (in sats)
};

export interface RenVMFees {
    [asset: string]: RenVMAssetFees;
}
