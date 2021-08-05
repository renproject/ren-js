import {
    BurnAndReleaseParams,
    DepositCommon,
    LockAndMintParams,
    LockChain,
    Logger,
    LogLevel,
    MintChain,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    SimpleLogger,
} from "@renproject/interfaces";
import { RenVMProvider } from "@renproject/rpc";
import BigNumber from "bignumber.js";

import { RenJSConfig } from "./config";
import { defaultDepositHandler } from "./defaultDepositHandler";
import { LockAndMint } from "./lockAndMint";

export { BurnAndRelease } from "./burnAndRelease";
export { LockAndMint, DepositStatus, LockAndMintDeposit } from "./lockAndMint";

/**
 * This is the main exported class from `@renproject/ren`.
 *
 * ```typescript
 * import RenJS from "@renproject/ren";
 * ```
 *
 * By default, RenJS will connect to the RenVM mainnet network. To connect
 * to `testnet` or to configure a custom connection, RenJS takes an optional
 * provider object. See the [[constructor]] for more details.
 *
 * ```typescript
 * new RenJS(); // Same as `new RenJS("mainnet");`
 * new RenJS("testnet");
 * new RenJS(custom provider object);
 * ```
 *
 * It then exposes two main functions:
 * 1. [[lockAndMint]] - for transferring assets to Ethereum.
 * 2. [[burnAndRelease]] - for transferring assets out of Ethereum.
 *
 * Also see:
 * 1. [[getFees]] - for estimating the fees that will be incurred by minting or
 * burning.
 * 2. [[defaultDepositHandler]]
 *
 */
export default class RenJS {
    // /**
    //  * [STATIC] `Tokens` exposes the tokens that can be passed in to the lockAndMint and
    //  * burnAndRelease methods.
    //  */
    // public static Tokens = Tokens;

    /**
     * `Networks` exposes the network options that can be passed in to the RenJS
     * constructor. `Networks.Mainnet` resolves to the string `"mainnet"`.
     */
    public static Networks = RenNetwork;

    /**
     * `RenJS.defaultDepositHandler` can be passed as a deposit callback when
     * minting. It will handle submitting to RenVM and then to the mint-chain,
     * as long as a valid provider for the mint-chain is given.
     *
     * This is not recommended for front-ends, since it may trigger a wallet
     * pop-up unexpectedly when the mint is ready to be submitted.
     *
     * ```ts
     * lockAndMint.on("deposit", RenJS.defaultDepositHandler);
     * ```
     */
    public static defaultDepositHandler = defaultDepositHandler;

    /**
     * RenVM provider exposing `sendMessage` and other helper functions for
     * interacting with RenVM. See [[AbstractRenVMProvider]].
     *
     * ```ts
     * renJS.renVM.sendMessage("ren_queryNumPeers", {});
     * ```
     */
    public readonly renVM: RenVMProvider;

    private readonly _logger: Logger;

    private readonly _config: RenJSConfig;

    /**
     * Accepts the name of a network, or a network object.
     *
     * @param network Provide the name of a network - `"mainnet"` or `"testnet"` - or a network object.
     * @param providerOrConfig Provide a custom RPC provider, or provide RenJS configuration settings.
     */
    constructor(
        providerOrNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | RenVMProvider
            | null
            | undefined,
        config?: RenJSConfig,
    ) {
        // const provider: string | Provider | undefined;
        // let config: RenJSConfig | undefined;
        // if (
        //     providerOrConfig &&
        //     (typeof providerOrConfig === "string" ||
        //         (providerOrConfig as Provider).sendMessage)
        // ) {
        //     provider = providerOrConfig as string | Provider;
        // } else if (providerOrConfig) {
        //     config = providerOrConfig as RenJSConfig;
        // }

        this._config = config || {};
        this._logger =
            (config && config.logger) ||
            new SimpleLogger((config && config.logLevel) || LogLevel.Error);

        this._config.logger = this._logger;
        const defaultProvider = () =>
            new RenVMProvider(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                (providerOrNetwork || RenNetwork.Mainnet) as
                    | RenNetwork
                    | RenNetworkString
                    | RenNetworkDetails,
                undefined,
                this._logger,
            );
        // Use provided provider, provider URL or default lightnode URL.
        this.renVM =
            providerOrNetwork &&
            typeof providerOrNetwork !== "string" &&
            (providerOrNetwork as RenVMProvider).sendMessage
                ? (providerOrNetwork as RenVMProvider)
                : defaultProvider();
    }

    public getFees = async ({
        asset,
        from,
        to,
    }: {
        asset: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: LockChain<any, any, any> | MintChain<any, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: LockChain<any, any, any> | MintChain<any, any>;
    }): Promise<{
        lock?: BigNumber;
        release?: BigNumber;
        mint: number;
        burn: number;
    }> => {
        if (!(await from.assetIsSupported(asset))) {
            throw new Error(`Asset not supported by chain ${from.name}.`);
        }
        if (!(await to.assetIsSupported(asset))) {
            throw new Error(`Asset not supported by chain ${to.name}.`);
        }

        if (await from.assetIsNative(asset)) {
            // LockAndMint
            return await this.renVM.estimateTransactionFee(asset, from, to);
        } else if (await to.assetIsNative(asset)) {
            // BurnAndRelease
            return await this.renVM.estimateTransactionFee(asset, to, from);
        } else {
            // BurnAndMint
            return await this.renVM.estimateTransactionFee(asset, from, to);
        }
    };

    /**
     * `lockAndMint` initiates the process of bridging an asset from its native
     * chain to a host chain.
     *
     * See [[LockAndMintParams]] for all the options that can be set.
     *
     * Returns a [[LockAndMint]] object.
     *
     * Example initialization:
     *
     * ```js
     * const lockAndMint = renJS.lockAndMint({
     *     asset: "BTC",
     *     from: Bitcoin(),
     *     to: Ethereum(web3Provider).Account({
     *         address: "0x...",
     *     }),
     * });
     * ```
     *
     * @param params See [[LockAndMintParams]].
     */
    public readonly move = async <
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Transaction = any,
        Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Address extends string | { address: string } = any,
    >(
        params: LockAndMintParams<Transaction, Deposit, Address>,
        config?: RenJSConfig,
    ): Promise<LockAndMint<Transaction, Deposit, Address>> =>
        new LockAndMint<Transaction, Deposit, Address>(this.renVM, params, {
            ...this._config,
            ...config,
        })._initialize();
}

/** The parameters for a lock-and-mint RenVM transaction. */
export interface MoveParameters<
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<LockTransaction>,
    MintTransaction = any,
    MintAddress extends string | { address: string } = any,
> {
    /** The asset being minted, e.g. `"BTC"`. */
    asset: string;

    /**
     * The chain that the asset is native to.
     */
    from: LockChain<LockTransaction, LockDeposit>;

    /**
     * The chain that the asset is being bridged to - e.g. `Ethereum(provider)`.
     */
    to: MintChain<MintTransaction, MintAddress>;

    /** An optional 32-byte buffer to generate unique gateway addresses. */
    nonce?: Buffer;
}
