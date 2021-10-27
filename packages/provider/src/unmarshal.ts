import BigNumber from "bignumber.js";

import { TxStatus } from "@renproject/utils";

import { TypedPackValue, unmarshalTypedPackValue } from "./pack/pack";
import { ResponseQueryTx } from "./rpc/methods";
import { UrlBase64String } from "./value";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UnmarshalledTxInput<Input = any> {
    hash: UrlBase64String;
    version: number;
    selector: string; // "BTC/fromEthereum",
    in: Input;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UnmarshalledTxOutput<Input = any, Output = any>
    extends UnmarshalledTxInput<Input> {
    out: Output;
}

export interface TxResponseWithStatus<
    Transaction extends UnmarshalledTxOutput,
> {
    tx: Transaction;
    txStatus: TxStatus;
}

export interface CrossChainTxInput {
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
}

export interface CrossChainTxOutput {
    amount: BigNumber;
    fees: BigNumber;
    hash: Buffer;
    revert: string;
    sig: Buffer;
    sighash: Buffer;
    txid: Buffer;
    txindex: BigNumber;
}

export type CrossChainTxResponse = UnmarshalledTxOutput<
    // Input
    CrossChainTxInput,
    // Output
    CrossChainTxOutput
>;

export const unmarshalTxResponse = <
    Input,
    Output,
    TypedInput extends TypedPackValue = TypedPackValue,
    TypedOutput extends TypedPackValue = TypedPackValue,
>(
    tx: ResponseQueryTx<TypedInput, TypedOutput>["tx"],
): UnmarshalledTxOutput<Input, Output> => ({
    version: parseInt(tx.version),
    hash: tx.hash,
    selector: tx.selector,
    in: unmarshalTypedPackValue(tx.in),
    out: unmarshalTypedPackValue(tx.out),
});

export const unmarshalCrossChainTxResponse = (
    tx: ResponseQueryTx["tx"],
): CrossChainTxResponse => unmarshalTxResponse(tx);
