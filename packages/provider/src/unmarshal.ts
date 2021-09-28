import BigNumber from "bignumber.js";

import { TxStatus } from "@renproject/interfaces/build/main";

import { TypedPackValue, unmarshalTypedPackValue } from "./pack/pack";
import { ResponseQueryTx } from "./rpc/methods";
import { UrlBase64String } from "./value";

export interface TxResponse<Input = any, Output = any> {
    version?: number;
    hash: UrlBase64String;
    to: string;
    in: Input;
    out?: Output;
}

export interface TxResponseWithStatus<Transaction extends TxResponse> {
    tx: Transaction;
    txStatus: TxStatus;
}

export type CrossChainTxResponse = TxResponse<
    // Input
    {
        amount: BigNumber;
        ghash: Buffer;
        gpubkey: Buffer;
        nhash: Buffer;
        nonce: Buffer;
        payload: Buffer;
        phash: Buffer;
        to: string;
        txid: Buffer;
        txindex: BigNumber;
    },
    // Output
    {
        amount: BigNumber;
        hash: Buffer;
        sig: Buffer;
        sighash: Buffer;
        txid: Buffer;
        txindex: BigNumber;
        revert?: string | "";
    }
>;

export const unmarshalTxResponse = <
    Input,
    Output,
    TypedInput extends TypedPackValue = TypedPackValue,
    TypedOutput extends TypedPackValue = TypedPackValue,
>(
    tx: ResponseQueryTx<TypedInput, TypedOutput>["tx"],
): TxResponse<Input, Output> => {
    return {
        version: parseInt(tx.version),
        hash: tx.hash,
        to: tx.selector,
        in: unmarshalTypedPackValue(tx.in),
        out: unmarshalTypedPackValue(tx.out),
    };
};

export const unmarshalCrossChainTxResponse = (
    tx: ResponseQueryTx["tx"],
): CrossChainTxResponse => {
    return unmarshalTxResponse(tx);
};
