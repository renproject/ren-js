// tslint:disable: no-any

import {
    AbiItem,
    BurnTransaction,
    Logger,
    MintTransaction,
    RenContract,
    TxStatus,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";

export interface AbstractRenVMProvider {
    version: number;

    getFees: () => Promise<any>;

    submitMint: (
        renContract: RenContract,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        // tslint:disable-next-line: no-any
        output: any,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        token: string,
        fn: string,
        fnABI: AbiItem[],
        tags: [string] | []
    ) => Promise<string>;

    submitBurn: (
        renContract: RenContract,
        amount: BigNumber,
        token: string,
        to: string,
        ref: BigNumber,
        tags: [string] | []
    ) => Promise<string>;

    queryMintOrBurn: <T extends MintTransaction | BurnTransaction>(
        utxoTxHash: Buffer
    ) => Promise<T>;

    waitForTX: <T extends MintTransaction | BurnTransaction>(
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean
    ) => Promise<T>;

    /**
     * selectPublicKey fetches the key for the RenVM shard handling
     * the provided contract.
     *
     * @param {RenContract} renContract The Ren Contract for which the public
     *        key should be fetched.
     * @returns The key hash (20 bytes) as a string.
     */
    selectPublicKey: (
        renContract: RenContract,
        logger?: Logger
    ) => Promise<Buffer>;

    // In the future, this will be asynchronous. It returns a promise for
    // compatibility.
    getNetwork: () => Promise<string>;

    mintTxHash: (
        renContract: RenContract,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        // tslint:disable-next-line: no-any
        output: any,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        token: string,
        outputHashFormat: string
    ) => string;
}
