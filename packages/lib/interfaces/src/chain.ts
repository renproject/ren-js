/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { EventEmitter } from "events";

import { Logger } from "./logger";
import { RenNetwork, RenNetworkDetails, RenNetworkString } from "./networks";
import {
    BurnAndReleaseParams,
    ContractCall,
    LockAndMintParams,
} from "./parameters";
import { LockAndMintTransaction } from "./transaction";

export type SyncOrPromise<T> = Promise<T> | T;

// export type TransactionListener<
//     T,
//     E extends { [key: string]: any[] }
// > = PromiEvent<
//     T,
//     {
//         txHash: [string];
//         confirmation: [number, number];
//         target: [number, number];
//     } & E
// >;

export interface BurnPayloadConfig {
    bytes?: boolean;
}

/**
 * # Adding chains
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
 */
export interface ChainCommon<
    Transaction = any,
    Address extends string | { address: string } = any,
    Network = any,
> extends ChainStatic<Transaction, Address, Network> {
    /**
     * The name of the Chain.
     *
     * ```ts
     * bitcoin.name = "Bitcoin";
     * ```
     */
    name: string;

    /**
     * The name of the Chain used the v0.2 RenVM nodes.
     *
     * ```ts
     * bitcoin.legacyName = "Btc";
     * ```
     */
    legacyName?: string;

    /**
     * Should be set by `constructor` or `initialize`.
     */
    renNetwork?: RenNetworkDetails;

    // Class Initialization

    /**
     * `initialize` allows RenJS to pass in parameters after the user has
     * initialized the Chain. This allows the user to pass in network
     * parameters such as the network only once.
     *
     * If the Chain's constructor has an optional network parameter and the
     * user has explicitly initialized it, the Chain should ignore the
     * network passed in to `initialize`. This is to allow different network
     * combinations, such as working with testnet Bitcoin and a local Ethereum
     * chain - whereas the default `testnet` configuration would use testnet
     * Bitcoin and Ethereum's Kovan testnet.
     */
    initialize: (
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => SyncOrPromise<this>;

    withProvider?: (...args: any[]) => SyncOrPromise<this>;

    // Supported assets

    /**
     * `assetIsNative` should return true if the asset is native to the Chain.
     * Mint-chains should return `false` for assets that have been bridged to
     * it.
     *
     * ```ts
     * ethereum.assetIsNative = asset => asset === "ETH" ||;
     * ```
     */
    assetIsNative: (asset: string) => SyncOrPromise<boolean>;

    /**
     * `assetIsSupported` should return true if the the asset is native to the
     * chain or if the asset can be minted onto the chain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH" || asset === "BTC" || ...;
     * ```
     */
    assetIsSupported: (asset: string) => SyncOrPromise<boolean>;

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     * ```ts
     * bitcoin.assetDecimals = asset => {
     *     if (asset === "BTC") { return 8; }
     *     throw new Error(`Unsupported asset ${asset}.`);
     * }
     * ```
     */
    assetDecimals: (asset: string) => SyncOrPromise<number>;

    // Transaction helpers

    /**
     * `transactionID` should return a string that uniquely represents the
     * transaction.
     */
    transactionID: (transaction: Transaction) => string;

    /**
     * `transactionConfidence` should return a target and a current
     * confidence that the deposit is irreversible. For most chains, this will
     * be represented by the number of blocks that have passed.
     *
     * For example, a Bitcoin transaction with 2 confirmations will return
     * `{ current: 2, target: 6 }` on mainnet, where the target is currently 6
     * confirmations.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain.
     */
    transactionConfidence: (
        transaction: Transaction,
    ) => SyncOrPromise<{ current: number; target: number }>;

    transactionRPCFormat: (
        transaction: Transaction,
        v2?: boolean,
    ) => {
        txid: Buffer;
        txindex: string;
    };

    transactionRPCTxidFromID: (transactionID: string, v2?: boolean) => Buffer;

    /**
     * `transactionIDFromRPCFormat` accepts a txid and txindex and returns the
     * transactionID as returned from `transactionID`.
     */
    transactionIDFromRPCFormat: (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
    ) => string;

    transactionFromRPCFormat: (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
    ) => SyncOrPromise<Transaction>;
    /**
     * @deprecated Renamed to `transactionFromRPCFormat`.
     * Will be removed in 3.0.0.
     */
    transactionFromID: (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
    ) => SyncOrPromise<Transaction>;

    transactionRPCFormatExplorerLink?: (
        txid: string | Buffer,
        txindex: string,
        reversed?: boolean,
        network?: RenNetwork | RenNetworkString | RenNetworkDetails | Network,
        explorer?: string,
    ) => string | undefined;
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
    /**
     * The LockChain's address format. This should contain all the information
     * users need to
     */
    Address extends string | { address: string } = any,
    /**
     * The LockChain's network options.
     */
    Network = any,
    /**
     * GetDeposits can track its progress using a `progress` value.
     */
    GetDepositProgress = any,
> extends ChainCommon<Transaction, Address, Network> {
    // Deposits

    /**
     * `getDeposits` should return all deposits that have been made to the
     * provided address, confirmed or unconfirmed.
     * `getDeposits` will get called in a loop by LockAndMintObjects, but a
     * LockChain has the option of instead handling this itself by not
     * returning, and streaming deposits using the onDeposit method.
     */
    getDeposits: (
        asset: string,
        address: Address,
        // The chain can return back a value that represents its progress. For
        // example, Bitcoin returns back a single boolean in order to detect if
        // it's the first time deposits are being fetched, doing a more
        // extensive query for the first call.
        progress: GetDepositProgress | undefined,
        onDeposit: (deposit: LockDeposit) => Promise<void>,
        // If a deposit is no longer valid, cancelDeposit should be called with
        // the same details. NOTE: Not implemented yet in RenJS.
        cancelDeposit: (deposit: LockDeposit) => Promise<void>,
        listenerCancelled: () => boolean,
    ) => SyncOrPromise<GetDepositProgress>;

    // Encoding

    /**
     * `addressToBytes` should return the bytes representation of the address.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain's
     * `decodeAddress` method.
     */
    addressToBytes: (address: Address | string) => Buffer;

    /**
     * `bytesToAddress` should return the string representation of the address.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain's
     * `encodeAddress` method.
     */
    bytesToAddress: (bytes: Buffer) => Address | string;

    /**
     * @deprecated Renamed to addressToBytes.
     */
    addressStringToBytes: (address: string) => Buffer;

    addressToString: (address: Address | string) => string;

    // RenVM specific utils

    /**
     * `getGatewayAddress` should return the deposit address expected by RenVM
     * for the given asset and gateway hash (`gHash`). The public key is that of
     * the shard selected to handle the deposits.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain.
     */
    getGatewayAddress: (
        asset: string,
        publicKey: Buffer,
        gHash: Buffer,
    ) => SyncOrPromise<Address>;

    // Only chains supported by the legacy transaction format (BTC, ZEC & BCH)
    // need to support this. For now, other chains can return an empty string.
    depositV1HashString: (deposit: LockDeposit) => string;

    burnPayload?: (
        burnPayloadConfig?: BurnPayloadConfig,
    ) => SyncOrPromise<string | undefined>;
}

export interface BurnDetails<Transaction> {
    transaction: Transaction;
    amount: BigNumber;
    to: string;
    nonce: BigNumber;
}

export type OverwritableLockAndMintParams = Omit<
    Omit<Partial<LockAndMintParams>, "to">,
    "from"
>;
export type OverwritableBurnAndReleaseParams = Omit<
    Omit<Partial<BurnAndReleaseParams>, "to">,
    "from"
>;

export interface MintChain<
    Transaction = any,
    Address extends string | { address: string } = any,
    Network = any,
> extends ChainCommon<Transaction, Address, Network> {
    resolveTokenGatewayContract: (asset: string) => SyncOrPromise<string>;

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    submitMint: (
        asset: string,
        contractCalls: ContractCall[],
        mintTx: LockAndMintTransaction,
        eventEmitter: EventEmitter,
    ) => SyncOrPromise<Transaction>;

    /**
     * Finds a transaction by its nonce and optionally signature,
     * as used in Ethereum based chains
     */
    findTransaction?: (
        asset: string,
        nHash: Buffer,
        sigHash?: Buffer,
    ) => SyncOrPromise<Transaction | undefined>;

    /**
     * Finds a transaction by its details
     * as used in Solana
     */
    findTransactionByDepositDetails?: (
        asset: string,
        sHash: Buffer,
        nHash: Buffer,
        pHash: Buffer,
        to: string,
        amount: string,
    ) => SyncOrPromise<Transaction | undefined>;

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findBurnTransaction: (
        asset: string,

        // Once of the following should not be undefined.
        burn: {
            transaction?: Transaction;
            burnNonce?: Buffer | string | number;
            contractCalls?: ContractCall[];
        },

        eventEmitter: EventEmitter,
        logger: Logger,
        networkDelay?: number,
    ) => SyncOrPromise<BurnDetails<Transaction>>;

    /**
     * Fetch the mint and burn fees for an asset.
     */
    getFees(asset: string): SyncOrPromise<{
        burn: number;
        mint: number;
    }>;

    /**
     * Fetch the addresses' balance of the asset's representation on the chain.
     */
    getBalance(asset: string, address: Address): SyncOrPromise<BigNumber>;

    getMintParams?: (
        asset: string,
    ) => SyncOrPromise<OverwritableLockAndMintParams | undefined>;

    getBurnParams?: (
        asset: string,
        burnPayload?: string,
    ) => SyncOrPromise<OverwritableBurnAndReleaseParams | undefined>;

    burnPayloadConfig?: BurnPayloadConfig;
}

/**
 * Chains should provide a set of static utilities.
 */
export interface ChainStatic<
    Transaction = any,
    DepositAddress extends string | { address: string } = any,
    Network = any,
> {
    utils: {
        // Map from a RenVM network to the chain's network.
        resolveChainNetwork(
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | Network,
        ): Network;

        /**
         * Return a boolean indicating whether the address is valid for the
         * chain's network.
         *
         * @param address
         * @param network
         */
        addressIsValid(
            address: DepositAddress | string,
            network?:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | Network,
        ): boolean;

        /**
         * Return a boolean indicating whether the transaction is valid for the
         * chain's network.
         *
         * @param address
         * @param network
         */
        transactionIsValid(
            address: Transaction | string,
            network?:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | Network,
        ): boolean;

        /**
         * `addressExplorerLink` should return a URL that can be shown to a user
         * to access more information about an address.
         *
         * `explorer` can be provided to request a link to a different explorer.
         * It's up to the chain implementation to choose how to interpret this.
         */
        addressExplorerLink?: (
            address: DepositAddress | string,
            network?:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | Network,
            explorer?: string,
        ) => string | undefined;

        /**
         * `transactionExplorerLink` should return a URL that can be shown to a user
         * to access more information about a transaction.
         *
         * `explorer` can be provided to request a link to a different explorer.
         * It's up to the chain implementation to choose how to interpret this.
         */
        transactionExplorerLink?: (
            transaction: Transaction | string,
            network?:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | Network,
            explorer?: string,
        ) => string | undefined;
    };
}
