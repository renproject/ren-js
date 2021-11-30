import { RenVMProvider } from "@renproject/provider";
import {
    Chain,
    isContractChain,
    RenJSError,
    RenNetwork,
    RenNetworkString,
    RenVMShard,
    withCode,
} from "@renproject/utils";

import { RenJSConfig } from "./config";
import { defaultDepositHandler } from "./defaultDepositHandler";
import { estimateTransactionFee, GatewayFees } from "./fees";
import { Gateway } from "./gateway";
import { GatewayTransaction, TransactionParams } from "./gatewayTransaction";
import { GatewayParams } from "./params";

export { Gateway } from "./gateway";
export { GatewayTransaction } from "./gatewayTransaction";
export { GatewayFees } from "./fees";

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
 * 2. [[defaultDepositHandler]]
 *
 */
export class RenJS {
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
     * @param providerOrNetwork Provider the name of a RenNetwork or a RenVM provider instance.
     * @param config
     */
    public constructor(
        providerOrNetwork:
            | RenNetwork
            | RenNetworkString
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

    // eslint-disable-next-line @typescript-eslint/array-type
    public withChains = <T extends Chain[]>(...chains: T): this => {
        for (const chain of chains) {
            this.chains[chain.chain] = chain;
        }
        return this;
    };
    public withChain = this.withChains;

    public getChain = (name: string): Chain => {
        if (!this.chains[name]) {
            throw withCode(
                new Error(
                    `Chain ${name} not found. (Must call 'renJS.withChains(${name.toLowerCase()})')`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        return this.chains[name];
    };

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

        if (
            !(
                (await fromChain.isLockAsset(asset)) ||
                (isContractChain(fromChain) &&
                    (await fromChain.isMintAsset(asset)))
            )
        ) {
            throw withCode(
                new Error(`Asset not supported by chain ${fromChain.chain}.`),
                RenJSError.PARAMETER_ERROR,
            );
        }
        if (
            !(
                (await toChain.isLockAsset(asset)) ||
                (isContractChain(toChain) && (await toChain.isMintAsset(asset)))
            )
        ) {
            throw withCode(
                new Error(`Asset not supported by chain ${toChain.chain}.`),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return await estimateTransactionFee(
            this.provider,
            asset,
            toChain,
            fromChain,
        );
    };

    public readonly selectShard = async (asset: string): Promise<RenVMShard> =>
        this.provider.selectShard(asset);

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
    public readonly gateway = async <
        FromPayload extends { chain: string; txConfig?: any } = any,
        ToPayload extends { chain: string; txConfig?: any } = any,
    >(
        params: GatewayParams<FromPayload, ToPayload>,
        config: RenJSConfig = {},
    ): Promise<Gateway<FromPayload, ToPayload>> =>
        new Gateway<FromPayload, ToPayload>(
            this.provider,
            this.getChain(params.from.chain),
            this.getChain(params.to.chain),
            params,
            {
                ...this._config,
                ...config,
            },
        ).initialize();

    public readonly gatewayTransaction = async <
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
            params,
            undefined,
            {
                ...this._config,
                ...config,
            },
        ).initialize();
}

export default RenJS;
