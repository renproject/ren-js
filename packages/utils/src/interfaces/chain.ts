import BigNumber from "bignumber.js";

import { TxSubmitter, TxWaiter } from "../txSubmitter";
import { UrlBase64String } from "./types";

export type SyncOrPromise<T> = Promise<T> | T;

export enum InputType {
    Lock = "lock",
    Burn = "burn",
}

export enum OutputType {
    Mint = "mint",
    Release = "release",
}

// A NumericString should be a valid numeric value, represented by a string to
// avoid precision issues, while still being JSON-encodable.
export type NumericString = string;

export interface ChainTransaction {
    chain: string;
    txid: UrlBase64String;
    txindex: NumericString;

    txidFormatted: string;
}

export interface InputChainTransaction extends ChainTransaction {
    amount: string;
    toRecipient?: string;
    toChain?: string;

    nonce?: string; // urlBase64 encoded
    toPayload?: string; // urlBase64 encoded
}

/**
 * # Adding chains #
 *
 * Once a chain has been added to the [multichain repo](https://github.com/renproject/multichain) and accepted by the
 * darknodes, a handler can be written for RenJS.
 *
 * The expected interface can be found in `../interfaces/src/chain.ts`. There are two types of chains - lock chains and
 * mint chains, each requiring a different handler interface. Lock chain handlers are for chains where funds are locked
 * up under RenVM's control - e.g. Bitcoin or Zcash. A mint chain handler is for the chain where the wrapped tokens are
 * created - e.g. Ethereum.
 *
 * If a chain is a fork of another supported chain, it's recommended that the handler extends the forked chain's
 * handler.
 *
 * If a chain has multiple assets (e.g. ETH and ERC20s), it's recommended that a single handler is written that supports
 * all the relevant assets.
 *
 * NOTE: The following interfaces are not final and are subject to change
 * across patch and minor versions.
 */

export interface ChainCommon {
    chain: string;

    // Expose a map of assets supported by the chain. Note that the list may
    // not be complete, and will become out-of-date as new assets are added.
    // Should only be used to improve readability when integrating with RenJS.
    assets: { [asset: string]: string };

    /** Override the chain's provider. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withProvider?: (...args: any[]) => SyncOrPromise<this>;

    /** Return true if the asset originates from the chain. */
    assetIsNative: (asset: string) => SyncOrPromise<boolean>;

    /** Return true if the asset is native or can be minted on the chain. */
    assetIsSupported: (asset: string) => SyncOrPromise<boolean>;

    /** Return the asset's decimals, or throw for an unsupported asset. */
    assetDecimals: (asset: string) => SyncOrPromise<number>;

    /** Return a transactions current number of confirmations. */
    transactionConfidence: (
        transaction: ChainTransaction,
    ) => SyncOrPromise<BigNumber>;

    /** Fetch the address's asset balance. */
    getBalance(asset: string, address: string): SyncOrPromise<BigNumber>;

    /** Check if the address's format is valid. */
    validateAddress(address: string): boolean;

    /** Check if the transaction's format is valid. */
    validateTransaction(transaction: ChainTransaction): boolean;

    /** Return a URL to the address's page on an explorer. */
    addressExplorerLink: (address: string) => string | undefined;

    transactionHash(transaction: { txid: string; txindex: string }): string;

    /** Return a URL to the transaction's page on an explorer. */
    transactionExplorerLink: (
        transaction: ChainTransaction,
    ) => string | undefined;

    // /** Return a TxWaiter instance for the provided chain transaction. */
    // getTxWaiter: (
    //     tx: ChainTransaction,
    //     target?: number,
    // ) => SyncOrPromise<TxWaiter>;
}

export interface DepositChain<
    FromPayload extends { chain: string } = {
        chain: string;
    },
    ToPayload extends { chain: string } = {
        chain: string;
    },
> extends ChainCommon {
    isDepositAsset: (asset: string) => SyncOrPromise<boolean>;

    /**
     * Generate a gateway address deterministically from a shard's public key
     * and a gateway hash.
     */
    createGatewayAddress: (
        asset: string,
        fromPayload: FromPayload,
        shardPublicKey: Buffer,
        gHash: Buffer,
    ) => SyncOrPromise<string>;

    /** Watch for deposits made to the provided address. */
    watchForDeposits: (
        asset: string,
        fromPayload: FromPayload,
        address: string,
        onInput: (input: InputChainTransaction) => void,
        removeInput: (input: InputChainTransaction) => void,
        listenerCancelled: () => boolean,
    ) => Promise<void>;

    /** Return toPayload in standard to/payload format. */
    getOutputPayload: (
        asset: string,
        type: OutputType.Release,
        toPayload: ToPayload,
    ) => SyncOrPromise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isDepositChain = (chain: any): chain is DepositChain =>
    (chain as DepositChain).createGatewayAddress !== undefined &&
    (chain as DepositChain).watchForDeposits !== undefined;

export interface ContractChain<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FromContractCall extends { chain: string } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToContractCall extends { chain: string } = FromContractCall,
> extends ChainCommon {
    // Get contract addresses.
    getRenAsset: (asset: string) => SyncOrPromise<string>;
    getMintGateway: (asset: string) => SyncOrPromise<string>;
    getLockAsset: (asset: string) => SyncOrPromise<string>;
    getLockGateway: (asset: string) => SyncOrPromise<string>;

    // Setup transactions //////////////////////////////////////////////////////

    getInputSetup?: (
        asset: string,
        type: InputType,
        contractCall: FromContractCall,
    ) => SyncOrPromise<{
        [key: string]: TxSubmitter | TxWaiter;
    }>;

    getOutputSetup?: (
        asset: string,
        type: OutputType,
        contractCall: ToContractCall,
    ) => SyncOrPromise<{
        [key: string]: TxSubmitter | TxWaiter;
    }>;

    // Input and output transactions ///////////////////////////////////////////

    /**
     * Submit a lock or a burn transaction. The return type is an array of
     * `InputChainTransaction` because there may be multiple lock or burn events
     * in the transaction.
     */
    getInputTx: (
        type: InputType,
        asset: string,
        contractCall: FromContractCall,
        params: () => {
            toChain: string;
            toPayload: {
                to: string;
                toBytes: Buffer;
                payload: Buffer;
            };
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
        removeInput: (input: InputChainTransaction) => void,
    ) => SyncOrPromise<TxSubmitter | TxWaiter>;

    /**
     * Lookup a mint or release using the unique nHash.
     */
    lookupOutput: (
        type: OutputType,
        asset: string,
        contractCall: ToContractCall,
        renParams: {
            amount: BigNumber;
            sHash: Buffer;
            pHash: Buffer;
            nHash: Buffer;
        },
        confirmationTarget: number,
    ) => SyncOrPromise<TxWaiter | undefined>;

    /**
     * Submit a mint or release transaction. When this is initially called as
     * a pre-check, the sigHash and signature will not be set.
     */
    getOutputTx: (
        type: OutputType,
        asset: string,
        contractCall: ToContractCall,
        params: () => {
            amount: BigNumber;
            sHash: Buffer;
            pHash: Buffer;
            nHash: Buffer;
            sigHash?: Buffer;
            signature?: {
                r: Buffer;
                s: Buffer;
                v: number;
            };
        },
        confirmationTarget: number,
    ) => SyncOrPromise<TxSubmitter | TxWaiter>;

    getOutputPayload: (
        asset: string,
        type: OutputType,
        contractCall: ToContractCall,
    ) => SyncOrPromise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isContractChain = (chain: any): chain is ContractChain =>
    (chain as ContractChain).getInputTx !== undefined &&
    // (chain as ContractChain).submitLock !== undefined &&
    (chain as ContractChain).getOutputTx !== undefined;
// && (chain as ContractChain).submitRelease !== undefined

export type Chain<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FromPayload extends { chain: string; chainClass?: Chain } = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ToPayload extends { chain: string; chainClass?: Chain } = any,
> =
    | DepositChain<FromPayload, ToPayload>
    | ContractChain<FromPayload, ToPayload>;
