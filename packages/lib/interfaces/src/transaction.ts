import { AbiItem } from "./abi";
import { RenContract } from "./networks";
import { Base64String, TxStatus } from "./types";

export interface RenTransaction<Input, Output> {
    hash: Base64String;
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
            value: Buffer;
            fn: string;
        };
        token: string;
        to: string;
        n: Buffer;
        utxo: {
            txHash: string;
            vOut: number;
            scriptPubKey: string;
            amount: string;
        };
    },
    // Output
    {
        phash: Buffer;
        amount: string;
        ghash: Buffer;
        nhash: Buffer;
        sighash: Buffer;
        signature?: Buffer;
    }
>;

export type BurnTransaction = RenTransaction<
    // Input
    {
        ref: string;
        to: string;
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
