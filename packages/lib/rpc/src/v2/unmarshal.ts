import {
    AbiItem,
    BurnTransaction,
    Logger,
    MintTransaction,
    RenVMAssetFees,
    RenVMFees,
} from "@renproject/interfaces";
import { assert, fixSignature, Ox, signatureToBuffer } from "@renproject/utils";
import BigNumber from "bignumber.js";

import {
    ResponseQueryBurnTx,
    ResponseQueryFees,
    ResponseQueryMintTx,
} from "./methods";
import { unmarshalPackValue, unmarshalTypedPackValue } from "./pack";
import { Fees, RenVMOutputUTXO, RenVMType } from "./value";

const decodeString = (input: string) => Buffer.from(input, "base64").toString();
const decodeBytes = (input: string) => Ox(Buffer.from(input, "base64"));
const decodeNumber = (input: string) => new BigNumber(input);

export const unmarshalMintTx = (
    response: ResponseQueryMintTx
): MintTransaction => {
    // Note: Numbers are decoded and re-encoded to ensure they are in the correct format.

    // TODO: Check that response is mint response.
    // assert(
    //     parseRenContract(response.tx.to).to === "Eth",
    //     `Expected mint details but got back burn details (${response.tx.hash} - ${response.tx.to})`
    // );

    return {
        hash: decodeBytes(response.tx.hash),
        txStatus: response.txStatus,
        to: response.tx.to,
        in: unmarshalTypedPackValue(response.tx.in),
        out: response.tx.out
            ? unmarshalTypedPackValue(response.tx.out)
            : undefined,
    };
};

export const unmarshalBurnTx = (
    response: ResponseQueryBurnTx
): BurnTransaction => {
    // TODO: Check that result is burn response.
    // assert(
    //     parseRenContract(response.tx.to).from === Chain.Ethereum,
    //     `Expected burn details but got back mint details (${response.tx.hash} - ${response.tx.to})`
    // );

    return {
        hash: decodeBytes(response.tx.hash),
        to: response.tx.to,
        in: unmarshalTypedPackValue(response.tx.in),
        txStatus: response.txStatus,
    };
};

const unmarshalAssetFees = (fees: Fees): RenVMAssetFees => {
    const { lock, release, ...tokens } = fees;

    // TODO: Fix type errors.
    return ({
        lock: decodeNumber(lock).toNumber(),
        release: decodeNumber(release).toNumber(),
        ...Object.keys(tokens).reduce(
            (acc, token) => ({
                ...acc,
                [token]: {
                    mint: decodeNumber(fees[token].mint).toNumber(),
                    burn: decodeNumber(fees[token].burn).toNumber(),
                },
            }),
            {}
        ),
    } as unknown) as RenVMAssetFees;
};

export const unmarshalFees = (response: ResponseQueryFees): RenVMFees => {
    return {
        btc: unmarshalAssetFees(response.btc),
        zec: unmarshalAssetFees(response.zec),
        bch: unmarshalAssetFees(response.bch),
    };
};
