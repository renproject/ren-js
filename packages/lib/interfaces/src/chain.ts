import BigNumber from "bignumber.js";

import { EventEmitterTyped } from "./promiEvent";

export type SyncOrPromise<T> = Promise<T> | T;

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

export interface ChainCommon<Transaction = any> {
    /** A  */
    name: string;

    /** Override the chain's provider. */
    withProvider?: (...args: any[]) => SyncOrPromise<this>;

    /** Return true if the asset originates from the chain. */
    assetIsNative: (asset: string) => SyncOrPromise<boolean>;

    /** Return true if the asset is native or can be minted on the chain. */
    assetIsSupported: (asset: string) => SyncOrPromise<boolean>;

    /** Return the asset's decimals, or throw for an unsupported asset. */
    assetDecimals: (asset: string) => SyncOrPromise<number>;

    /** Return a transactions current number of confirmations. */
    transactionConfidence: (transaction: Transaction) => SyncOrPromise<number>;

    /** Fetch the address's asset balance. */
    getBalance(asset: string, address: string): SyncOrPromise<BigNumber>;

    /** Check if the address's format is valid. */
    validateAddress(address: string): boolean;

    /** Check if the transaction's format is valid. */
    validateTransaction(transaction: Transaction): boolean;

    /** Return a URL to the address's page on an explorer. */
    addressExplorerLink: (address: string) => string | undefined;

    /** Return a URL to the transaction's page on an explorer. */
    transactionExplorerLink: (transaction: Transaction) => string | undefined;

    /** Convert a transaction to a standard format for displaying to users. */
    transactionReadable: (transaction: Transaction) => string;

    /** Convert an asset's amount to its smallest unit. */
    toSmallestUnit: (
        asset: string,
        amount: BigNumber | number | string,
    ) => Promise<BigNumber>;

    /** Convert an asset's amount in its smallest unit to its whole unit. */
    fromSmallestUnit: (
        asset: string,
        amount: BigNumber | number | string,
    ) => Promise<BigNumber>;

    // Encoding ////////////////////////////////////////////////////////////////

    /** Convert an address to the bytes representation as used by RenVM. */
    addressToBytes: (address: string) => Buffer;

    /** Convert an address from the bytes representation as used by RenVM. */
    bytesToAddress: (bytes: Buffer) => string;

    /** Convert a transaction to its txid and txindex as used by RenVM. */
    transactionToIdAndIndex: (transaction: Transaction) => {
        txid: Buffer;
        txindex: string;
    };

    /** Convert a transaction from its txid and txindex as used by RenVM. */
    transactionFromIdAndIndex: (
        txid: Buffer,
        txindex: string,
    ) => SyncOrPromise<Transaction>;
}

export type DepositCommon<Transaction = any> = {
    transaction: Transaction;
    amount: string;
};

/**
 * LockChain is a chain with one or more native assets that can be locked in a
 * key controlled by RenVM to be moved onto a MintChain, and then released when
 * they are burnt from the MintChain.
 *
 * LockChains can extend other chain implementations using JavaScript's class
 * inheritance. For example, if a LockChain is a Bitcoin fork, it can extend the
 * Bitcoin LockChain and overwrite methods as necessary. See the ZCash and
 * BitcoinCash implementations for examples of this.
 */
export interface LockChain<
    Transaction = any,
    /**
     * A deposit contains a transaction to a gateway address, and includes extra
     * information including an amount field.
     */
    LockDeposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
> extends ChainCommon<Transaction> {
    /**
     * Generate a gateway address deterministically from a shard's public key
     * and a gateway hash.
     */
    createGatewayAddress: (
        asset: string,
        shardPublicKey: Buffer,
        gHash: Buffer,
    ) => SyncOrPromise<string>;

    /** Watch for deposits made to the provided address. */
    watchForDeposits: (
        asset: string,
        address: string,
        onDeposit: (deposit: LockDeposit) => Promise<void>,
        removeDeposit: (deposit: LockDeposit) => Promise<void>,
        listenerCancelled: () => boolean,
    ) => Promise<void>;

    /**
     * Allow the chain to specify a payload for minting to the chain or for
     * burning to the chain.
     */
    getBurnOrMintPayload: (asset: string) => {
        to: string;
        payload: Buffer;
    };
}

export interface BurnDetails<Transaction> {
    transaction: Transaction;
    amount: BigNumber;
    to: string;
    nonce: BigNumber;
}

export interface MintChain<
    Transaction = any,
    MintConfig = any,
    BurnConfig = any,
> extends ChainCommon<Transaction> {
    resolveTokenGatewayContract: (asset: string) => SyncOrPromise<string>;

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    submitMint: (
        mintConfig: MintConfig,
        asset: string,
        to: string,
        payload: Buffer,
        r: Buffer,
        s: Buffer,
        v: Buffer,
        eventEmitter: EventEmitterTyped<{
            transactionHash: [string];
            confirmation: [number, { status: number }];
        }>,
    ) => SyncOrPromise<Transaction>;

    /**
     * Finds a transaction by its nonce and optionally signature,
     * as used in Ethereum based chains
     */
    findMint?: (
        asset: string,
        nHash: Buffer,
        sHash: Buffer,
        pHash: Buffer,
        to: string,
        amount: string,
        sigHash?: Buffer,
    ) => SyncOrPromise<Transaction | undefined>;

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findOrSubmitBurn: (
        asset: string,
        burnConfig: BurnConfig,
        eventEmitter: EventEmitterTyped<{
            transactionHash: [string];
            confirmation: [number, { status: number }];
        }>,
    ) => SyncOrPromise<BurnDetails<Transaction> | undefined>;

    getPayload: (asset: string) => {
        to: string;
        payload: Buffer;
    };
}
