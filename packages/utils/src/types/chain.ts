/* eslint-disable @typescript-eslint/no-explicit-any */

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
    /** The chain on which the transaction is on. */
    chain: string;
    /** A base64-formatted transaction hash. */
    txid: UrlBase64String;
    /** The index of the specific event/message/transfer inside the transaction - "0" if not applicable. */
    txindex: NumericString;
    /** A human-readable form of the txid. */
    txHash: string;
    /** A URL to an explorer's page for this transaction. */
    explorerLink: string;
}

export interface InputChainTransaction extends ChainTransaction {
    asset: string;
    amount: string;
    toRecipient?: string;
    toChain?: string;

    nonce?: string; // urlBase64 encoded
    toPayload?: string; // urlBase64 encoded
}

/**
 * # Adding chains #
 *
 * Once a chain has been added to the
 * [multichain repo](https://github.com/renproject/multichain)
 * and accepted by the darknodes, a handler can be written for RenJS.
 *
 * There are two categories of chains - deposit chains and contract chains, each
 * required to implement a different set of functions. A chain may implement
 * both sets of functions. Deposit chains are lock-chains where funds are locked
 * by sending them to a gateway address, while contract chains are either
 * lock-chains where funds are locked through a function call, or mint-chains
 * capable of hosting assets from other chains.
 *
 * If a chain is a fork of another supported chain, it can extend/inherit from
 * the original chain's class to simplify adding support. This is currently done
 * for Bitcoin-based chains and for EVM-based chains.
 *
 * If a chain has multiple assets (e.g. ETH and ERC20s), it's recommended that
 * a single handler is written that supports all the relevant assets.
 *
 * NOTE: The following interfaces are not final and are subject to change
 * across patch and minor versions.
 */

export interface ChainCommon {
    chain: string;

    /**
     * Chains should store network-specific configuration in the `network`
     * field.
     */
    network: {
        /** The fee that fees are paid in. */
        nativeAsset?: {
            name: string;
            symbol: string;
            decimals: number;
        };

        /** The average number of seconds between blocks being produced. */
        averageConfirmationTime?: number;
    };

    // Expose a map of assets supported by the chain. Note that the list may
    // not be complete, and will become out-of-date as new assets are added.
    // Should only be used to improve readability when integrating with RenJS.
    assets: { [asset: string]: string };

    /** Override the chain's provider. */
    provider?: any;
    withProvider?: (...providers: any[]) => SyncOrPromise<this>;

    /** Override the chain's signer. */
    signer?: any;
    withSigner?: (...signers: any[]) => SyncOrPromise<this>;
    checkSignerNetwork?: () => SyncOrPromise<{
        result: boolean;
        actualNetworkId: string | number;
        expectedNetworkId: string | number;
        expectedNetworkLabel: string;
    }>;
    switchSignerNetwork?: () => SyncOrPromise<void>;

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
    validateTransaction(
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): boolean;

    /** Return a URL to the address's page on an explorer. */
    addressExplorerLink: (address: string) => string | undefined;

    addressToBytes: (address: string) => Uint8Array;
    addressFromBytes: (bytes: Uint8Array) => string;
    txHashToBytes: (txHash: string) => Uint8Array;
    txHashFromBytes: (bytes: Uint8Array) => string;

    /** Return a URL to the transaction's page on an explorer. */
    transactionExplorerLink: (
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ) => string | undefined;

    // /** Return a TxWaiter instance for the provided chain transaction. */
    // getTxWaiter: (
    //     tx: ChainTransaction,
    //     target?: number,
    // ) => SyncOrPromise<TxWaiter>;
}

export interface DepositChain<
    FromPayload extends { chain: string; txConfig?: any } = any,
    ToPayload extends { chain: string; txConfig?: any } = any,
> extends ChainCommon {
    /** Return true if the asset originates from the chain. */
    isLockAsset: (asset: string) => SyncOrPromise<boolean>;

    /**
     * On contract chains, some lock assets may be deposit assets and others
     * may be locked through a smart contract.
     */
    isDepositAsset: (asset: string) => SyncOrPromise<boolean>;

    /**
     * Generate a gateway address deterministically from a shard's public key
     * and a gateway hash.
     *
     * The shardPublicKey is a compressed secp256k1 public key.
     */
    createGatewayAddress: (
        asset: string,
        fromPayload: FromPayload,
        shardPublicKey: Uint8Array,
        gHash: Uint8Array,
    ) => SyncOrPromise<string>;

    /** Watch for deposits made to the provided address. */
    watchForDeposits?: (
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
        inputType: InputType,
        outputType: OutputType,
        toPayload: ToPayload,
    ) => SyncOrPromise<
        | {
              to: string;
              toBytes: Uint8Array;
              payload: Uint8Array;
          }
        | undefined
    >;
}

export const isDepositChain = (chain: any): chain is DepositChain =>
    (chain as DepositChain).createGatewayAddress !== undefined;

export interface ContractChain<
    FromContractCall extends { chain: string; txConfig?: any } = any,
    ToContractCall extends { chain: string; txConfig?: any } = FromContractCall,
> extends ChainCommon {
    /** Return true if the asset originates from the chain. */
    isLockAsset: (asset: string) => SyncOrPromise<boolean>;

    /** Return true if the asset can be minted on the chain. */
    isMintAsset: (asset: string) => SyncOrPromise<boolean>;

    // Get contract addresses.
    getMintAsset: (asset: string) => SyncOrPromise<string>;
    getMintGateway: (asset: string) => SyncOrPromise<string>;
    getLockAsset: (asset: string) => SyncOrPromise<string>;
    getLockGateway: (asset: string) => SyncOrPromise<string>;

    // Setup transactions //////////////////////////////////////////////////////

    getInSetup?: (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: FromContractCall,
        getParams: () => {
            toChain: string;
            toPayload:
                | {
                      to: string;
                      toBytes: Uint8Array;
                      payload: Uint8Array;
                  }
                | undefined;
            gatewayAddress?: string;
        },
    ) => SyncOrPromise<{
        [key: string]: TxSubmitter | TxWaiter;
    }>;

    getOutSetup?: (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: ToContractCall,
        getParams: () => {
            pHash: Uint8Array;
            nHash: Uint8Array;
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
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
        inputType: InputType,
        outputType: OutputType,
        asset: string,
        contractCall: FromContractCall,
        getParams: () => {
            toChain: string;
            toPayload:
                | {
                      to: string;
                      toBytes: Uint8Array;
                      payload: Uint8Array;
                  }
                | undefined;
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
        removeInput: (input: InputChainTransaction) => void,
    ) => SyncOrPromise<TxSubmitter | TxWaiter>;

    /**
     * Submit a mint or release transaction. When this is initially called as
     * a pre-check, the sigHash and signature will not be set.
     */
    getOutputTx: (
        inputType: InputType,
        outputType: OutputType,
        asset: string,
        contractCall: ToContractCall,
        params: () => {
            sHash: Uint8Array;
            pHash: Uint8Array;
            nHash: Uint8Array;

            // Only available during the transaction submission, not when
            // getOutputTx is called.
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
        confirmationTarget: number,
    ) => SyncOrPromise<TxSubmitter | TxWaiter>;

    getOutputPayload: (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: ToContractCall,
    ) => SyncOrPromise<
        | {
              to: string;
              toBytes: Uint8Array;
              payload: Uint8Array;
          }
        | undefined
    >;
}

export const isContractChain = (chain: any): chain is ContractChain =>
    (chain as ContractChain).getInputTx !== undefined &&
    // (chain as ContractChain).submitLock !== undefined &&
    (chain as ContractChain).getOutputTx !== undefined;
// && (chain as ContractChain).submitRelease !== undefined

export type Chain<
    FromPayload extends { chain: string; txConfig?: any } = any,
    ToPayload extends { chain: string; txConfig?: any } = FromPayload,
> =
    | DepositChain<FromPayload, ToPayload>
    | ContractChain<FromPayload, ToPayload>;
