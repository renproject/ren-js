import {
    AbiItem,
    BurnAndReleaseTransaction,
    LockAndMintTransaction,
    LockChain,
    MintChain,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    SyncOrPromise,
    TxStatus,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import { Provider } from "@renproject/provider";

export interface AbstractRenVMProvider<
    Requests extends {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [event: string]: any;
    } = {},
    Responses extends {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [event: string]: any;
    } = {},
> extends Provider<Requests, Responses> {
    selector: (params: {
        asset: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: LockChain<any, any, any> | MintChain<any, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: LockChain<any, any, any> | MintChain<any, any>;
    }) => string;

    version: (selector: string) => number;

    mintTxHash: (params: {
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txindex: string; txid: Buffer };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
        outputHashFormat: string;
        transactionVersion?: number;
    }) => Buffer;

    submitGatewayDetails?: (
        gateway: string,
        params: {
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            payload: Buffer;
            pHash: Buffer;
            to: string;
            token: string;
            fn: string;
            fnABI: AbiItem[];
            tags: [string] | [];
            transactionVersion?: number;
        },
        retries?: number,
    ) => SyncOrPromise<string>;

    submitMint: (
        params: {
            selector: string;
            gHash: Buffer;
            gPubKey: Buffer;
            nHash: Buffer;
            nonce: Buffer;
            output: { txindex: string; txid: Buffer };
            amount: string;
            payload: Buffer;
            pHash: Buffer;
            to: string;
            token: string;
            fn: string;
            fnABI: AbiItem[];
            tags: [string] | [];
            transactionVersion?: number;
        },
        retries?: number,
    ) => SyncOrPromise<Buffer>;

    burnTxHash?: (params: {
        // v2
        selector: string;
        gHash: Buffer;
        gPubKey: Buffer;
        nHash: Buffer;
        nonce: Buffer;
        output: { txid: Buffer; txindex: string };
        amount: string;
        payload: Buffer;
        pHash: Buffer;
        to: string;
    }) => Buffer;

    submitBurn: (
        params: {
            selector: string;
            tags: [string] | [];

            // v1
            burnNonce: BigNumber;

            // v2
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
        retries?: number,
    ) => SyncOrPromise<Buffer>;

    queryMintOrBurn: <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction,
    >(
        selector: string,
        utxoTxHash: Buffer,
        retries?: number,
    ) => SyncOrPromise<T>;

    waitForTX: <T extends LockAndMintTransaction | BurnAndReleaseTransaction>(
        selector: string,
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
        timeout?: number,
    ) => SyncOrPromise<T>;

    /**
     * selectPublicKey fetches the key for the RenVM shard handling
     * the provided contract.
     *
     * @returns The key hash (20 bytes) as a string.
     */
    selectPublicKey: (
        selector: string,
        assetOrChain: string,
    ) => SyncOrPromise<Buffer>;

    /**
     * Used to query what network a custom provider is connected to. LockAndMint
     * and BurnAndRelease use this to configure their chain parameters.
     */
    getNetwork: (
        selector: string,
    ) => SyncOrPromise<RenNetwork | RenNetworkString | RenNetworkDetails>;

    /**
     * Look up the number of confirmations required by RenVM.
     */
    getConfirmationTarget?: (
        selector: string,
        chain: { name: string },
    ) => SyncOrPromise<number | undefined>;

    /**
     * Return the estimated fee RenVM will use for locking and releasing.
     */
    estimateTransactionFee: (
        asset: string,
        lockChain: { name: string; legacyName?: string },
        hostChain: { name: string; legacyName?: string },
    ) => SyncOrPromise<{
        lock: BigNumber;
        release: BigNumber;
        mint: number;
        burn: number;
    }>;
}
