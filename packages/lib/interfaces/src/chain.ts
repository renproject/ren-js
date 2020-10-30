import BigNumber from "bignumber.js";
import { EventEmitter } from "events";

import { Logger } from "./logger";
import { RenNetwork } from "./networks";
import { ContractCall } from "./parameters";
import { PromiEvent } from "./promiEvent";
import { MintTransaction } from "./transaction";
import { EventType } from "./types";

export type SyncOrPromise<T> = Promise<T> | T;

export type TransactionListener<
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    E extends { [key: string]: any[] }
> = PromiEvent<
    T,
    {
        txHash: [string];
        confirmation: [number, number];
        target: [number, number];
    } & E
>;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transaction = any,
    Asset = string,
    Address = string
> {
    /**
     * The name of the Chain.
     *
     * @example
     * bitcoin.name = "Bitcoin";
     */
    name: string;

    /**
     * The name of the Chain used the v0.2 RenVM nodes.
     *
     * @example
     * bitcoin.legacyName = "Btc";
     */
    legacyName?: string;

    /**
     * Should be set by `constructor` or `initialize`.
     */
    renNetwork?: RenNetwork;

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
    initialize: (network: RenNetwork) => SyncOrPromise<this>;

    // Supported assets

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

    // Address and transaction helpers

    addressIsValid: (address: Address) => boolean;

    /**
     * `addressExplorerLink` should return a URL that can be shown to a user
     * to access more information about an address.
     */
    addressExplorerLink?: (address: Address) => string | undefined;

    /**
     * `transactionID` should return a string that uniquely represents the
     * transaction.
     */
    transactionID: (transaction: Transaction) => string;

    /**
     * `transactionExplorerLink` should return a URL that can be shown to a user
     * to access more information about a transaction.
     */
    transactionExplorerLink?: (transaction: Transaction) => string | undefined;

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transaction = any,
    LockDeposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    Asset = string,
    Address = string
> extends ChainCommon<Transaction, Asset, Address> {
    // Assets

    /**
     * `assetIsNative` should return true if the asset is native to the Chain.
     */
    assetIsNative: (asset: Asset) => SyncOrPromise<boolean>;

    // Deposits

    /**
     * `getDeposits` should return all deposits that have been made to the
     * provided address, confirmed or unconfirmed.
     * `getDeposits` will get called in a loop by LockAndMintObjects, but a
     * LockChain has the option of instead handling this itself by not
     * returning, and streaming deposits using the onDeposit method.
     */
    getDeposits: (
        asset: Asset,
        address: Address,
        // instanceID allows the chain to internally track it's progress in
        // searching for deposits for a particular LockAndMint object.
        // For example - the Bitcoin LockChain will fetch spent deposits
        // the first time getDeposits is called for a particular instanceID and
        // address, and only return unspent deposits in successive calls.
        instanceID: number,
        onDeposit: (deposit: LockDeposit) => void,
        listenerCancelled: () => boolean,
    ) => SyncOrPromise<void>;

    // Encoding

    /**
     * `addressBytes` should return the bytes representation of the address.
     *
     * @dev Must be compatible with the matching RenVM multichain LockChain's
     * `decodeAddress` method.
     */
    addressStringToBytes: (address: string) => Buffer;

    // RenVM specific utils

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
        gHash: Buffer,
    ) => SyncOrPromise<Address>;

    getPubKeyScript: (
        asset: Asset,
        publicKey: Buffer,
        gHash: Buffer,
    ) => SyncOrPromise<Buffer>;

    // Only chains supported by the legacy transaction format (BTC, ZEC & BCH)
    // need to support this. For now, other chains can return an empty string.
    depositV1HashString: (deposit: LockDeposit) => string;

    burnPayload?: () => SyncOrPromise<string | undefined>;
}

export interface BurnDetails<Transaction> {
    transaction: Transaction;
    amount: BigNumber;
    to: string;
    nonce: BigNumber;
}

export interface MintChain<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transaction = any,
    Asset = string,
    Address = string
> extends ChainCommon<Transaction, Asset, Address> {
    // /**
    //  * `supportsAsset` should return true if the the asset can be minted onto
    //  * this chain.
    //  *
    //  * @example
    //  * ethereum.supportsAsset = asset => asset === "BTC" ||;
    //  */
    // supportsAsset: (asset: Asset) => SyncOrPromise<boolean>;

    resolveTokenGatewayContract: (asset: Asset) => Promise<string>;

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    submitMint: (
        asset: Asset,
        contractCalls: ContractCall[],
        mintTx: MintTransaction,
        eventEmitter: EventEmitter,
    ) => SyncOrPromise<Transaction>;

    findTransaction: (
        asset: Asset,
        mintTx: MintTransaction,
    ) => SyncOrPromise<Transaction | undefined>;

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     * like gas.
     * @returns {(PromiEvent<BurnAndRelease, { [event: string]: any }>)}
     */
    findBurnTransaction: (
        asset: string,

        // Once of the following should not be undefined.
        burn: {
            transaction?: Transaction;
            burnNonce?: string | number;
            contractCalls?: ContractCall[];
        },

        eventEmitter: EventEmitter,
        logger: Logger,
    ) => SyncOrPromise<BurnDetails<Transaction>>;

    contractCalls?: (
        eventType: EventType,
        asset: Asset,
        burnPayload?: string,
    ) => SyncOrPromise<ContractCall[] | undefined>;
}
