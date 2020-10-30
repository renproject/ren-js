import {
    AbiItem,
    Asset,
    BurnTransaction,
    Logger,
    MintTransaction,
    RenContract,
    SyncOrPromise,
    TxStatus,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";

export interface AbstractRenVMProvider {
    version: number;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFees: () => Promise<any>;

    mintTxHash: (
        renContract: RenContract,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        output: { txindex: string; txid: Buffer },
        amount: string,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        outputHashFormat: string,
    ) => Buffer;

    submitMint: (
        renContract: RenContract,
        gHash: Buffer,
        gPubKey: Buffer,
        nHash: Buffer,
        nonce: Buffer,
        output: { txindex: string; txid: Buffer },
        amount: string,
        payload: Buffer,
        pHash: Buffer,
        to: string,
        token: string,
        fn: string,
        fnABI: AbiItem[],
        tags: [string] | [],
    ) => SyncOrPromise<Buffer>;

    burnTxHash?: (
        params: {
            // v2

            renContractOrSelector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txid: Buffer; txindex: string };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
        },
        logger?: Logger,
    ) => SyncOrPromise<Buffer>;

    submitBurn: (
        params:
            | {
                  // v2

                  renContractOrSelector: string;
                  gHash: Buffer;
                  gPubKey: Buffer;
                  nHash: Buffer;
                  nonce: Buffer;
                  output: { txid: Buffer; txindex: string };
                  amount: string;
                  payload: Buffer;
                  pHash: Buffer;
                  to: string;
              }
            | {
                  // v1
                  renContract: RenContract;
                  burnNonce: BigNumber;
              },
        tags: [string] | [],
        logger?: Logger,
    ) => SyncOrPromise<Buffer>;

    queryMintOrBurn: <T extends MintTransaction | BurnTransaction>(
        utxoTxHash: Buffer,
    ) => SyncOrPromise<T>;

    waitForTX: <T extends MintTransaction | BurnTransaction>(
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
    ) => SyncOrPromise<T>;

    /**
     * selectPublicKey fetches the key for the RenVM shard handling
     * the provided contract.
     *
     * @param {RenContract} renContract The Ren Contract for which the public
     * key should be fetched.
     * @returns The key hash (20 bytes) as a string.
     */
    selectPublicKey: (token: Asset) => SyncOrPromise<Buffer>;

    getNetwork: () => SyncOrPromise<string>;
}
