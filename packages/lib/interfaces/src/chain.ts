import { EventEmitter } from "events";

import { Logger } from "./logger";
import { RenNetwork } from "./networks";
import { ContractCall, RenTokens } from "./parameters";
import { MintTransaction } from "./transaction";
import { EventType } from "./types";

export type SyncOrPromise<T> = Promise<T> | T;

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
    Transaction = {},
    Asset extends string = string,
    Address extends string = string
> {
    /**
     * The name of the LockChain.
     *
     * @example
     * bitcoin.name = "Bitcoin";
     */
    name: string;

    /**
     * Should be set by `constructor` and `initialize`.
     */
    renNetwork?: RenNetwork;

    // Class Initialization

    /**
     * `initialize` allows RenJS to pass in parameters after the user has
     * initialized the LockChain. This allows the user to pass in network
     * parameters such as the network only once.
     *
     * If the LockChain's constructor has an optional network parameter and the
     * user has explicitly initialized it, the LockChain should ignore the
     * network passed in to `initialize`. This is to allow different network
     * combinations, such as working with testnet Bitcoin and a local Ethereum
     * chain - whereas the default `testnet` configuration would use testnet
     * Bitcoin and Ethereum's Kovan testnet.
     */
    initialize: (network: RenNetwork) => SyncOrPromise<this>;

    // Supported assets

    /**
     * `supportsAsset` should return true if the asset is native to the
     * LockChain.
     *
     * @example
     * bitcoin.supportsAsset = asset => asset === "BTC";
     */
    supportsAsset: (asset: Asset) => SyncOrPromise<boolean>;

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     * @example
     * bitcoin.assetDecimals = asset => {
     *     if (asset === "BTC") { return 8; }
     *     throw new Error(`Unsupported asset ${asset}`);
     * }
     */
    assetDecimals: (asset: Asset) => SyncOrPromise<number>;

    // Deposits

    /**
     * `getDeposits` should return all previous deposits that have been made to
     * the address, confirmed or unconfirmed.
     *
     * TODO: Add pagination.
     */
    getDeposits: (
        asset: Asset,
        address: Address
    ) => SyncOrPromise<Transaction[]>;

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
        transaction: Transaction
    ) => SyncOrPromise<{ current: number; target: number }>;

    // Address

    /**
     * `getGatewayAddress` should return the deposit address expected by RenVM
     * for the given asset and gateway hash (`gHash`). The public key is that of
     * the shard selected to handle the deposits.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain.
     */
    getGatewayAddress: (
        asset: Asset,
        publicKey: Buffer,
        gHash: Buffer
    ) => SyncOrPromise<Address>;

    getPubKeyScript: (
        asset: Asset,
        publicKey: Buffer,
        gHash: Buffer
    ) => SyncOrPromise<Buffer>;

    // Encoding

    /**
     * `encodeAddress` should return a bytes representation of the provided
     * address. The default implementation is `address => Buffer.from(address)`.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain.
     */
    encodeAddress?: (address: Address) => Buffer;

    /**
     * `decodeAddress` should return the address represented by the provided
     * bytes. The default implementation is `buffer => buffer.toString()`.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain.
     */
    decodeAddress?: (encodedAddress: Buffer) => Address;

    // UI utilities

    /**
     * `addressExplorerLink` should return a URL that can be shown to a user
     * to access more information about an address.
     */
    addressExplorerLink?: (address: Address) => string;

    /**
     * `transactionExplorerLink` should return a URL that can be shown to a user
     * to access more information about a transaction.
     */
    transactionID: (transaction: Transaction) => string;

    transactionExplorerLink?: (transaction: Transaction) => string;

    transactionHashString: (transaction: Transaction) => string;

    transactionRPCFormat: (
        transaction: Transaction,
        pubKeyScript: Buffer,
        v2?: boolean
    ) => any; // tslint:disable-line: no-any

    generateNHash: (
        nonce: Buffer,
        deposit: Transaction,
        logger?: Logger
    ) => Buffer;

    burnPayload?: () => SyncOrPromise<string | undefined>;
}

/**
 * WARNING: This interface will be updated to match the Go multichain package's
 * interface. New MintChains should not be implemented using this interface.
 */
export interface MintChain<Transaction = {}, Asset extends string = string> {
    /**
     * The name of the MintChain.
     *
     * @example
     * ethereum.name = "ethereum";
     *
     * @dev Should match the key used in `ren_queryFees`.
     */
    name: string;

    /**
     * Should be set by `constructor` and `initialize`.
     */
    renNetwork?: RenNetwork;

    // Class Initialization

    /**
     * See [LockChain.initialize].
     */
    initialize: (network: RenNetwork) => SyncOrPromise<this>;

    // Supported assets

    /**
     * `supportsAsset` should return true if the asset is native to the
     * MintChain.
     *
     * @example
     * ethereum.supportsAsset = asset => asset === "ETH";
     */
    supportsAsset: (asset: Asset) => SyncOrPromise<boolean>;

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     * @example
     * ethereum.assetDecimals = asset => {
     *     if (asset === "ETH") { return 18; }
     *     throw new Error(`Unsupported asset ${asset}`);
     * }
     */
    assetDecimals: (asset: Asset) => SyncOrPromise<number>;

    resolveTokenGatewayContract: (token: RenTokens) => Promise<string>;

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    submitMint: (
        asset: Asset,
        contractCalls: ContractCall[],
        mintTx: MintTransaction,
        eventEmitter: EventEmitter
    ) => SyncOrPromise<Transaction>;

    findTransaction: (
        asset: Asset,
        mintTx: MintTransaction
    ) => SyncOrPromise<Transaction | undefined>;

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     *        like gas.
     * @returns {(PromiEvent<BurnAndRelease, { [event: string]: any }>)}
     */
    findBurnTransaction: (
        params: {
            ethereumTxHash?: Transaction;
            contractCalls?: ContractCall[];
            burnReference?: string | number | undefined;
        },
        eventEmitter: EventEmitter,
        logger: Logger,
        // tslint:disable-next-line: no-any
        txConfig?: any
    ) => SyncOrPromise<string | number>;

    contractCalls?: (
        eventType: EventType,
        asset: Asset,
        burnPayload?: string
    ) => SyncOrPromise<ContractCall[] | undefined>;
}
