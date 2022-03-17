import BigNumber from "bignumber.js";

import { TxStatus, UrlBase64String } from "@renproject/utils";

export interface RenVMBlock {
    height: BigNumber;
    hash: Uint8Array;
    parentHash: Uint8Array;
    commitment: Uint8Array;
    timestamp: BigNumber;
    round: BigNumber;
    stateRoot: Uint8Array;
    intrinsicTxs: Uint8Array[];
    extrinsicTxs: Uint8Array[];
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
        txid: Uint8Array;
        txindex: BigNumber;
        amount: BigNumber;
        payload: Uint8Array;
        phash: Uint8Array;
        to: string;
        nonce: Uint8Array;
        nhash: Uint8Array;
        gpubkey: Uint8Array;
        ghash: Uint8Array;
    },
    // Output
    {
        amount: BigNumber;
        fees: BigNumber;
        hash: Uint8Array;
        revert: string;
        sig: Uint8Array;
        sighash: Uint8Array;
        txid: Uint8Array;
        txindex: BigNumber;
    }
>;
