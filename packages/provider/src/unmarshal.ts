import BigNumber from "bignumber.js";

import {
    normalizeSignature,
    pack,
    TxStatus,
    TypedPackValue,
    UrlBase64String,
} from "@renproject/utils";

import { ResponseQueryTx } from "./methods";

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

export const unmarshalRenVMTransaction = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Input = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Output = any,
    TypedInput extends TypedPackValue = TypedPackValue,
    TypedOutput extends TypedPackValue = TypedPackValue,
>(
    tx: ResponseQueryTx<TypedInput, TypedOutput>["tx"],
): RenVMTransaction<Input, Output> => {
    // If the transaction has a signature output, apply standard signature fixes.
    const out = pack.unmarshal.unmarshalTypedPackValue(tx.out);
    if (out && out.sig && Buffer.isBuffer(out.sig) && out.sig.length > 0) {
        out.sig = normalizeSignature(out.sig);
    }

    return {
        version: parseInt(tx.version),
        hash: tx.hash,
        selector: tx.selector,
        in: pack.unmarshal.unmarshalTypedPackValue(tx.in),
        out,
    };
};
