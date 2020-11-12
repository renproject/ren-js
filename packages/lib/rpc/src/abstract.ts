import {
    AbiItem,
    BurnAndReleaseTransaction,
    LockAndMintTransaction,
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
    } = {}
> extends Provider<Requests, Responses> {
    version: number;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFees: () => Promise<any>;

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
    }) => Buffer;

    submitMint: (params: {
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
    }) => SyncOrPromise<Buffer>;

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

    submitBurn: (params: {
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
    }) => SyncOrPromise<Buffer>;

    queryMintOrBurn: <
        T extends LockAndMintTransaction | BurnAndReleaseTransaction
    >(
        utxoTxHash: Buffer,
    ) => SyncOrPromise<T>;

    waitForTX: <T extends LockAndMintTransaction | BurnAndReleaseTransaction>(
        utxoTxHash: Buffer,
        onStatus?: (status: TxStatus) => void,
        _cancelRequested?: () => boolean,
    ) => SyncOrPromise<T>;

    /**
     * selectPublicKey fetches the key for the RenVM shard handling
     * the provided contract.
     *
     * @returns The key hash (20 bytes) as a string.
     */
    selectPublicKey: (assetOrChain: string) => SyncOrPromise<Buffer>;

    /**
     * Used to query what network a custom provider is connected to. LockAndMint
     * and BurnAndRelease use this to configure their chain parameters.
     */
    getNetwork: () => SyncOrPromise<
        RenNetwork | RenNetworkString | RenNetworkDetails
    >;
}
