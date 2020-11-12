import {
    BurnAndReleaseParams,
    DepositCommon,
    LockAndMintParams,
    Logger,
    LogLevel,
    LogLevelString,
    RenNetwork,
    RenNetworkString,
    SimpleLogger,
} from "@renproject/interfaces";
import { AbstractRenVMProvider, CombinedProvider } from "@renproject/rpc";
import { Ox, randomNonce, strip0x } from "@renproject/utils";

import { BurnAndRelease } from "./burnAndRelease";
import { defaultDepositHandler } from "./defaultDepositHandler";
import { LockAndMint } from "./lockAndMint";

export interface RenJSConfig {
    logLevel?: LogLevelString;
    logger?: Logger;
}

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
     * `utils` exposes helper functions, See [[utils]].
     */
    public static utils = {
        Ox,
        strip0x,
        randomNonce,
    };

    public static defaultDepositHandler = defaultDepositHandler;

    // Not static
    public readonly utils = RenJS.utils;

    /**
     * RenVM provider exposing `sendMessage` and other helper functions for
     * interacting with RenVM. See [[AbstractRenVMProvider]].
     */
    public readonly renVM: AbstractRenVMProvider;

    private readonly _logger: Logger;

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
            | AbstractRenVMProvider
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

        this._logger =
            (config && config.logger) ||
            new SimpleLogger((config && config.logLevel) || LogLevel.Error);

        // Use provided provider, provider URL or default lightnode URL.
        this.renVM =
            providerOrNetwork && typeof providerOrNetwork !== "string"
                ? providerOrNetwork
                : new CombinedProvider(
                      providerOrNetwork || RenNetwork.Mainnet,
                      this._logger,
                  );
    }

    /**
     * `lockAndMint` initiates the process of bridging an asset from its native
     * chain to a host chain.
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
     *
     *     // Optional - 32-byte unique deposit nonce. Defaults to 0x0.
     *     nonce: RenJS.utils.randomNonce(),
     * });
     * ```
     *
     * @param params See [[LockAndMintParams]].
     */
    public readonly lockAndMint = async <
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Transaction = any,
        Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
        Address = string
    >(
        params: LockAndMintParams<Transaction, Deposit, Address>,
    ): Promise<LockAndMint<Transaction, Deposit, Address>> =>
        new LockAndMint<Transaction, Deposit, Address>(
            this.renVM,
            params,
            this._logger,
        )._initialize();

    /**
     * `burnAndRelease` submits a burn log to RenVM.
     * Returns a [[BurnAndRelease]] object.
     *
     * @param params See [[BurnAndReleaseParams]].
     * @returns An instance of [[BurnAndRelease]].
     */
    public readonly burnAndRelease = async <
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Transaction = any,
        Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
        Address = string
    >(
        params: BurnAndReleaseParams<Transaction, Deposit, Address>,
    ): Promise<BurnAndRelease<Transaction, Deposit, Address>> =>
        new BurnAndRelease<Transaction, Deposit, Address>(
            this.renVM,
            params,
            this._logger,
        )._initialize();

    public readonly getFees = async () => this.renVM.getFees();
}

// ////////////////////////////////////////////////////////////////////////// //
// EXPORTS                                                                    //
// Based on https://github.com/MikeMcl/bignumber.js/blob/master/bignumber.js  //
// ////////////////////////////////////////////////////////////////////////// //

/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */

(RenJS as any).default = (RenJS as any).RenJS = RenJS;

// AMD
try {
    // @ts-ignore
    if (typeof define === "function" && define.amd) {
        // @ts-ignore
        define(() => RenJS);
    }
} catch (error) {
    /* ignore */
}

// Node.js and other environments that support module.exports.
try {
    // @ts-ignore
    if (typeof module !== "undefined" && module.exports) {
        module.exports = RenJS;
    }
} catch (error) {
    /* ignore */
}

// Browser.
try {
    // @ts-ignore
    if (typeof window !== "undefined" && window) {
        (window as any).RenJS = RenJS;
    }
} catch (error) {
    /* ignore */
}
