import BigNumber from "bignumber.js";

import {
    Chain,
    LogLevel,
    RenNetwork,
    RenNetworkString,
    SimpleLogger,
} from "@renproject/interfaces";
import { RenVMProvider, unmarshalTypedPackValue } from "@renproject/provider";
import { BlockState } from "@renproject/provider/build/main/methods/ren_queryBlockState";

import { RenJSConfig } from "./config";
import { defaultDepositHandler } from "./defaultDepositHandler";
import { Gateway } from "./gateway";
import { GatewayParams } from "./params";

export { Gateway as LockAndMint } from "./gateway";

const estimateTransactionFee = async (
    renVM: RenVMProvider,
    asset: string,
    _lockChain: { chain: string },
    hostChain: { chain: string },
): Promise<{
    lock: BigNumber;
    release: BigNumber;
    mint: number;
    burn: number;
}> => {
    const renVMState = await renVM.queryBlockState();

    const blockState: BlockState = unmarshalTypedPackValue(renVMState.state);

    if (!blockState[asset]) {
        throw new Error(`No fee details found for ${asset}`);
    }

    const { gasLimit, gasCap } = blockState[asset];
    const fee = new BigNumber(gasLimit).times(new BigNumber(gasCap));

    const mintAndBurnFees = blockState[asset].fees.chains.filter(
        (chainFees) => chainFees.chain === hostChain.chain,
    )[0];

    return {
        lock: fee,
        release: fee,

        mint:
            mintAndBurnFees && mintAndBurnFees.mintFee
                ? mintAndBurnFees.mintFee.toNumber()
                : 15,
        burn:
            mintAndBurnFees && mintAndBurnFees.burnFee
                ? mintAndBurnFees.burnFee.toNumber()
                : 15,
    };
};

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

    public readonly chains: { [chain: string]: Chain } = {};

    /**
     * RenVM provider exposing `sendMessage` and other helper functions for
     * interacting with RenVM. See [[AbstractRenVMProvider]].
     *
     * ```ts
     * renJS.renVM.sendMessage("ren_queryNumPeers", {});
     * ```
     */
    public readonly renVM: RenVMProvider;

    private readonly _config: RenJSConfig;

    /**
     * Accepts the name of a network, or a network object.
     *
     * @param network Provide the name of a network - `"mainnet"` or `"testnet"` - or a network object.
     * @param providerOrConfig Provide a custom RPC provider, or provide RenJS configuration settings.
     */
    constructor(
        providerOrNetwork:
            | RenNetwork
            | RenNetworkString
            | RenVMProvider
            | string = RenNetwork.Mainnet,
        config?: RenJSConfig,
    ) {
        this._config = config || {};
        this._config.logger =
            this._config.logger ||
            new SimpleLogger((config && config.logLevel) || LogLevel.Error);

        this.renVM =
            typeof providerOrNetwork === "string"
                ? new RenVMProvider(
                      providerOrNetwork || RenNetwork.Mainnet,
                      this._config.logger,
                  )
                : providerOrNetwork;
    }

    // eslint-disable-next-line @typescript-eslint/array-type
    public withChains = <T extends Chain[]>(...chains: T): this => {
        for (const chain of chains) {
            this.chains[chain.chain] = chain;
        }
        return this;
    };

    public getChain = (name: string): Chain => {
        if (!this.chains[name]) {
            throw new Error(`Chain ${name} not set.`);
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
        from: Chain;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: Chain;
    }): Promise<{
        lock?: BigNumber;
        release?: BigNumber;
        mint: number;
        burn: number;
    }> => {
        if (!(await from.assetIsSupported(asset))) {
            throw new Error(`Asset not supported by chain ${from.chain}.`);
        }
        if (!(await to.assetIsSupported(asset))) {
            throw new Error(`Asset not supported by chain ${to.chain}.`);
        }

        if (await to.assetIsNative(asset)) {
            // BurnAndRelease
            return await estimateTransactionFee(this.renVM, asset, to, from);
        } else {
            // LockAndMint or BurnAndMint
            return await estimateTransactionFee(this.renVM, asset, from, to);
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
    public readonly gateway = async <
        FromPayload extends { chain: string } = {
            chain: string;
        },
        ToPayload extends { chain: string } = {
            chain: string;
        },
    >(
        params: GatewayParams<FromPayload, ToPayload>,
        config: RenJSConfig = {},
    ): Promise<Gateway<FromPayload, ToPayload>> =>
        new Gateway<FromPayload, ToPayload>(
            this.renVM,
            {
                ...params,
                fromChain: this.getChain(params.from.chain),
                toChain: this.getChain(params.to.chain),
            },
            {
                ...this._config,
                ...config,
            },
        )._initialize();
}
