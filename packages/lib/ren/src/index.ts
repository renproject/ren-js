import {
    BurnAndReleaseParams,
    LockAndMintParams,
    Logger,
    LogLevel,
    LogLevelString,
    RenNetwork,
    RenNetworkString,
    SimpleLogger,
} from "@renproject/interfaces";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { utils } from "@renproject/utils";

import { BurnAndRelease } from "./burnAndRelease";
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
 * It's initialized with a network, which controls both the RenVM network and
 * Ethereum chain to use:
 *
 * ```typescript
 * new RenJS(); // Same as `new RenJS("mainnet");`
 * new RenJS("testnet");
 * ```
 *
 * A second optional parameter lets you provide a RenVM RPC provider or a
 * lightnode URL. See the [[constructor]] for more details.
 *
 * It then exposes two main functions:
 * 1. [[lockAndMint]] - for transferring assets to Ethereum.
 * 2. [[burnAndRelease]] - for transferring assets out of Ethereum.
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
    public static utils: typeof utils = utils;

    // Not static
    public readonly utils: typeof utils = utils;

    /**
     * RenVM provider exposing `sendMessage` and other helper functions for
     * interacting with RenVM. See [[RenVMProvider]].
     */
    public readonly renVM: RenVMProvider;

    private readonly logger: Logger;

    /**
     * Accepts the name of a network, or a network object.
     * @param network Provide the name of a network - `"mainnet"` or `"testnet"` - or a network object.
     * @param providerOrConfig Provide a custom RPC provider, or provide RenJS configuration settings.
     */
    constructor(
        provider?:
            | RenNetwork
            | RenNetworkString
            | RenVMProvider
            | null
            | undefined,
        config?: RenJSConfig
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

        this.logger =
            (config && config.logger) ||
            new SimpleLogger((config && config.logLevel) || LogLevel.Error);

        // Use provided provider, provider URL or default lightnode URL.
        const rpcProvider =
            provider && typeof provider !== "string"
                ? provider
                : new RenVMProvider(
                      provider || RenNetwork.Mainnet,
                      undefined,
                      this.logger
                  );

        this.renVM = rpcProvider;
    }

    /**
     * `lockAndMint` initiates the process of bridging an asset from its native
     * chain to a host chain.
     *
     * Example initialization:
     *
     * ```js
     * const lockAndMint = renJS.lockAndMint({
     *     asset: "BTC",
     *     from: Bitcoin(),
     *     to: Ethereum(web3Provider),
     *
     *     // Unique value to generate unique deposit address.
     *     nonce: RenJS.utils.randomNonce(),
     *
     *     // Contract to be called for Ethereum
     *     contractCalls: [{
     *         sendTo: "0xb2731C04610C10f2eB6A26ad14E607d44309FC10",
     *         contractFn: "deposit",
     *         contractParams: [{
     *             name: "_msg",
     *             type: "bytes",
     *             value: web3.utils.fromAscii(`Depositing BTC`),
     *         }],
     *         txConfig: { gas: 500000 }
     *     }],
     * });
     * ```
     *
     * @param params See [[LockAndMintParams]].
     */
    public readonly lockAndMint = async (
        params: LockAndMintParams
    ): Promise<LockAndMint> => {
        const lockAndMint = new LockAndMint(this.renVM, params, this.logger);
        await lockAndMint.initialize();
        return lockAndMint;
    };

    /**
     * Submits a burn log to RenVM.
     *
     * @param params See [[BurnAndReleaseParams]].
     * @returns An instance of [[BurnAndRelease]].
     */
    public readonly burnAndRelease = (
        params: BurnAndReleaseParams
    ): BurnAndRelease => new BurnAndRelease(this.renVM, params, this.logger);

    public readonly getFees = async () => this.renVM.getFees();
}

////////////////////////////////////////////////////////////////////////////////
// EXPORTS                                                                    //
// Based on https://github.com/MikeMcl/bignumber.js/blob/master/bignumber.js  //
////////////////////////////////////////////////////////////////////////////////

// tslint:disable: no-any no-object-mutation strict-type-predicates no-typeof-undefined

// tslint:disable-next-line: no-string-literal
(RenJS as any)["default"] = (RenJS as any).RenJS = RenJS;

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
