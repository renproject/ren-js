import BigNumber from "bignumber.js";

import { TxStatus, UrlBase64String } from "@renproject/utils";

export interface RenVMBlock {
    height: BigNumber;
    hash: Buffer;
    parentHash: Buffer;
    commitment: Buffer;
    timestamp: BigNumber;
    round: BigNumber;
    stateRoot: Buffer;
    intrinsicTxs: Buffer[];
    extrinsicTxs: Buffer[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RenVMTransaction<Input = any, Output = any> {
    hash: UrlBase64String;
    version: number;
    selector: string; // "BTC/fromEthereum",
    in: Input;
    out?: Output;
}

export interface RenVMTransactionWithStatus<
    Transaction extends RenVMTransaction = RenVMTransaction,
> {
    tx: Transaction;
    txStatus: TxStatus;
}

export type RenVMCrossChainTransaction = RenVMTransaction<
    // Input
    {
        txid: Buffer;
        txindex: BigNumber;
        amount: BigNumber;
        payload: Buffer;
        phash: Buffer;
        to: string;
        nonce: Buffer;
        nhash: Buffer;
        gpubkey: Buffer;
        ghash: Buffer;
    },
    // Output
    {
        amount: BigNumber;
        fees: BigNumber;
        hash: Buffer;
        revert: string;
        sig: Buffer;
        sighash: Buffer;
        txid: Buffer;
        txindex: BigNumber;
    }
>;
