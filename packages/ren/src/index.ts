import { RenVMProvider } from "@renproject/provider";
import {
    assertType,
    Chain,
    ErrorWithCode,
    RenJSError,
    RenNetwork,
    RenVMShard,
} from "@renproject/utils";

import { Gateway } from "./gateway";
import { GatewayTransaction } from "./gatewayTransaction";
import { GatewayParams, TransactionParams } from "./params";
import { RenJSConfig } from "./utils/config";
import { defaultTransactionHandler } from "./utils/defaultTransactionHandler";
import { estimateTransactionFee, GatewayFees } from "./utils/fees";

export { Gateway } from "./gateway";
export { GatewayTransaction } from "./gatewayTransaction";
export { GatewayFees } from "./utils/fees";
export { RenVMTxSubmitter } from "./renVMTxSubmitter";

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
 * 1. [[gateway]] - for initiating new cross-chain transfers.
 * 2. [[gatewayTransaction]] - for continuing existing cross-chain transfers.
 *
 * Also see:
 * 1. [[getFees]] - for estimating the fees that will be incurred by minting or
 * burning.
 * 2. [[defaultTransactionHandler]] - a static function for handling
 * GatewayTransactions.
 *
 */
export class RenJS {
    /**
     * `Networks` exposes the network options that can be passed in to the RenJS
     * constructor. `Networks.Mainnet` resolves to the string `"mainnet"`.
     */
    public static Networks = RenNetwork;

    /**
     * `RenJS.defaultTransactionHandler` can be passed as a transaction callback when
     * minting. It will handle submitting to RenVM and then to the mint-chain,
     * as long as a valid provider for the mint-chain is given.
     *
     * This is not recommended for front-ends, since it may trigger a wallet
     * pop-up unexpectedly when the mint is ready to be submitted.
     *
     * ```ts
     * gateway.on("transaction", RenJS.defaultTransactionHandler);
     * ```
     */
    public static defaultTransactionHandler = defaultTransactionHandler;

    /**
     * In order to add support for chains, `withChains` must be called,
     * providing chain handlers that implement the Chain interface.
     */
    public readonly chains: { [chain: string]: Chain } = {};

    /**
     * RenVM provider exposing `sendMessage` and other helper functions for
     * interacting with RenVM. See [[AbstractRenVMProvider]].
     *
     * ```ts
     * renJS.renVM.sendMessage("ren_queryNumPeers", {});
     * ```
     */
    public readonly provider: RenVMProvider;

    private readonly _config: RenJSConfig;

    /**
     * Accepts the name of a network, or a network object.
     *
     * @param providerOrNetwork Provider the name of a RenNetwork or a RenVM
     * provider instance.
     * @param config Provider RenJS config such as a logger.
     */
    public constructor(
        providerOrNetwork:
            | RenNetwork
            | `${RenNetwork}`
            | RenVMProvider
            | string = RenNetwork.Mainnet,
        config?: RenJSConfig,
    ) {
        this._config = config || {};

        this.provider =
            typeof providerOrNetwork === "string"
                ? new RenVMProvider(providerOrNetwork, this._config.logger)
                : providerOrNetwork;
    }

    /**
     * Register one or more chain handlers, each implementing the Chain
     * interface. By default, RenJS has no chain handlers, so this is required
     * for all chains being bridged from or to.
     *
     * Note that any Gateway or GatewayTransaction instance that has already
     * been created will continue pointing to the chain handler at the time it
     * was created.
     */
    public withChains = <T extends Chain[]>(...chains: T): this => {
        for (const chain of chains) {
            this.chains[chain.chain] = chain;
        }
        return this;
    };
    public withChain = this.withChains;

    /**
     * Return the chain handler previously added using [[withChains]].
     */
    public getChain = <T extends Chain>(name: string): T => {
        assertType<string>("string", { name });
        if (!this.chains[name]) {
            throw ErrorWithCode.updateError(
                new Error(
                    `Chain ${name} not found. (Must call 'renJS.withChains(${name.toLowerCase()})')`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        return this.chains[name] as T;
    };

    /**
     * Calculate the RenVM and blockchain fees for a transaction.
     *
     * @example
     * renJS.getFees({
     *   asset: "BTC",
     *   from: "Bitcoin",
     *   to: "Ethereum",
     * })
     *
     * @example
     * renJS.getFees({
     *   asset: "BTC",
     *   from: bitcoin.GatewayAddress(),
     *   to: ethereum.Account(),
     * })
     */
    public getFees = async ({
        asset,
        from,
        to,
    }: {
        asset: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: string | { chain: string; txConfig?: any };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: string | { chain: string; txConfig?: any };
    }): Promise<GatewayFees> => {
        const fromChain = this.getChain(
            typeof from === "string" ? from : from.chain,
        );
        const toChain = this.getChain(typeof to === "string" ? to : to.chain);

        return await estimateTransactionFee(
            this.provider,
            asset,
            fromChain,
            toChain,
        );
    };

    /**
     * Return the recommended shard for processing transactions of the specified
     * asset.
     */
    public readonly selectShard = async (asset: string): Promise<RenVMShard> =>
        this.provider.selectShard(asset);

    /**
     * `gateway` initiates a new Gateway for bridging an asset between two
     * chains.
     *
     * See [[Gateway]] for all the options that can be set.
     *
     * @example
     * const gateway = renJS.gateway({
     *     asset: "BTC",
     *     from: bitcoin.GatewayAddress(),
     *     to: ethereum.Account(),
     * });
     * ```
     *
     * @param params See [[GatewayParams]]. This is a serializable object,
     * allowing gateways to be re-created.
     * @param config Optional RenJS config, such as a logger.
     */
    public readonly gateway = async <
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        FromPayload extends { chain: string; txConfig?: any } = any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ToPayload extends { chain: string; txConfig?: any } = any,
    >(
        params: GatewayParams<FromPayload, ToPayload>,
        config: RenJSConfig = {},
    ): Promise<Gateway<FromPayload, ToPayload>> =>
        new Gateway<FromPayload, ToPayload>(
            this.provider,
            this.getChain(params.from.chain),
            this.getChain(params.to.chain),
            // Make copy of params.
            {
                ...params,
                from: { ...params.from },
                to: { ...params.to },
                ...(params.shard ? { shard: { ...params.shard } } : {}),
            },
            {
                ...this._config,
                ...config,
            },
        ).initialize();

    /**
     * `gatewayTransaction` allows you to re-create a transaction emitted
     * by `gateway.on("transaction", (tx) => {...})`.
     *
     * @param params The same type as `tx.params` on an emitted `tx`. This is a
     * serializable object.
     * @param config Optional RenJS config, such as a logger.
     */
    public readonly gatewayTransaction = async <
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ToPayload extends { chain: string; txConfig?: any } = {
            chain: string;
        },
    >(
        params: TransactionParams<ToPayload>,
        config?: RenJSConfig,
    ): Promise<GatewayTransaction<ToPayload>> =>
        new GatewayTransaction<ToPayload>(
            this.provider,
            this.getChain(params.fromTx.chain),
            this.getChain(params.to.chain),
            // Make copy of params.
            {
                ...params,
                fromTx: { ...params.fromTx },
                to: { ...params.to },
                ...(params.shard ? { shard: { ...params.shard } } : {}),
            },
            undefined,
            {
                ...this._config,
                ...config,
            },
        ).initialize();
}

export default RenJS;
